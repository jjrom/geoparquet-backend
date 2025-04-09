'use strict';
const express = require('express');
const duckdb = require('duckdb');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const app = express();
const port = 3001;

// Handle result
const GEOPARQUET_FILE = process.env.GEOPARQUET_FILE;
const timeSuffix = 'T00:00:00';

console.log('Using GEOPARQUET_FILE : ' + GEOPARQUET_FILE)

// Caching mechanism
const useCache = true;
const CACHE_DIR = '/cache';
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR);
}

// Connect to DuckDB
const db = new duckdb.Database("/data/duckdb.db");

console.log('Loading duckdb extensions...');
db.exec("INSTALL spatial; LOAD spatial;INSTALL arrow;LOAD arrow;");
console.log('...done !');

// to support JSON-encoded bodies
app.use(express.json());

// to support URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.get("/", async (req, res) => {
    res.status(200).json({"message":"hello"});
});

/**
 * Get forecast at a specific timestamp (YYYY-MM-DD)
 */
app.get("/geojson/:timestamp", async (req, res) => {

    const limit = req.query.limit || null;
    const value = req.query.value || null;
    const timestamp = req.params.timestamp;

    var query = `
        SELECT time, ST_AsGeoJSON(geometry) as geometry, value FROM '${GEOPARQUET_FILE}'
        WHERE time = '${timestamp}${timeSuffix}'
    `;

    if (value) {
        query += ` AND value > ${value}`;
    }

    if (limit) {
        query += ` LIMIT ${limit}`;
    }

    try {

        db.all(query, (err, rows) => {

            if (err) {
                throw err;
            }

            // Construct GeoJSON FeatureCollection
            const geojson = {
                type: 'FeatureCollection',
                links: [
                    {
                        href: GEOPARQUET_FILE,
                        rel: 'data',
                        title: 'GeoParquet file',
                        type: 'application/vnd.apache.parquet'
                    }
                ],
                features: rows.map(row => ({
                    type: 'Feature',
                    properties: {
                        time: row.time,
                        value: row.value
                    },
                    geometry: JSON.parse(row.geometry), // Parsing GeoJSON geometry
                }))
            };

            // Return the GeoJSON response
            res.json(geojson);
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get forecast at a specific timestamp (YYYY-MM-DD)
 */
app.get("/geoarrow/:timestamp", async (req, res, next) => {

    const limit = req.query.limit || null;
    const value = req.query.value || null;
    const timestamp = req.params.timestamp;

    var query = `
        SELECT time, array_value(ST_X(ST_Centroid(geometry)), ST_Y(ST_centroid(geometry))) AS geometry, value FROM '${GEOPARQUET_FILE}'
        WHERE time = '${timestamp}${timeSuffix}'
    `;

    if (value) {
        query += ` AND value > ${value}`;
    }

    if (limit) {
        query += ` LIMIT ${limit}`;
    }

    try {

        db.arrowIPCAll(query,(err, data) => {

            if (err) {
              console.error(err);
            } else {
                res.status(200);
                res.contentType("application/arrow");
                res.chunkedEncoding = true;
                for (const chunk of data) {
                    if (chunk === undefined) {
                        // For some reason when the arrow table is empty
                        // the first element of the data array may be undefined.
                        // In that case, we just discard the element.
                        continue;
                    }
                    res.write(chunk);
                }
            }
            res.end();
        });
        
    } catch (e) {
        next(e);
    }

});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});


/** =================================================================================== */

/**
 * Hash a query to be used as a cache key
 * 
 * @param {string} query 
 * @returns 
 */
function hashQuery(query) {
    return crypto.createHash('sha256').update(query).digest('hex');
}

/**
 * Get cached result
 * 
 * @param {string} hash 
 * @returns 
 */
function getCachedResult(hash) {
    const cacheFile = path.join(CACHE_DIR, `${hash}.json`);
    if (fs.existsSync(cacheFile)) {
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }
    return null;
};

/**
 * Save data to cache
 * 
 * @param {string} hash 
 * @param {string} data 
 */
function saveToCache(hash, data) {
    const cacheFile = path.join(CACHE_DIR, `${hash}.json`);
    fs.writeFileSync(cacheFile, JSON.stringify(data), 'utf8');
};
