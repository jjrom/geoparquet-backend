SELECT 
    ST_AsGeoJSON(
        CASE 
            WHEN {zoom} <= 5 THEN ST_ConvexHull(ST_Union(geometry))  -- Extreme simplification
            WHEN {zoom} BETWEEN 6 AND 10 THEN ST_Simplify(ST_Union(geometry), 0.01)  -- Moderate simplification
            ELSE ST_Union(geometry)  -- Full detail at high zooms
        END
    ) AS geojson,
    AVG(value) AS avg_value  -- Compute average value for merged geometries
FROM '/Users/jrom/Devel/geoparquet-backend/data/march_2022_pred.parquet';

SELECT 
    ST_AsGeoJSON(
        ST_Simplify(ST_Collect(geometry), 0.01)
    ) AS geojson,
    AVG(value) AS avg_value
FROM '/Users/jrom/Devel/geoparquet-backend/data/march_2022_pred.parquet'
GROUP BY 
    ROUND(ST_XMin(geometry) / POWER(2, 20 - 1)),  -- X Grid
    ROUND(ST_YMin(geometry) / POWER(2, 20 - 1));  -- Y Grid;




INSTALL spatial;
LOAD spatial;

WITH aggregated_geometries AS (
    SELECT 
        -- Calculate the grid cell (grouping by the bounding box)
        ROUND(ST_XMin(geometry) / POWER(2, 20 - 1)) AS grid_x,
        ROUND(ST_YMin(geometry) / POWER(2, 20 - 1)) AS grid_y,
        
        -- Simplify geometry based on zoom level
        ST_Simplify(geometry, 0.01) AS simplified_geometry,
        
        -- Store the value for averaging later
        value
    FROM '/Users/jrom/Devel/geoparquet-backend/data/march_2022_pred.parquet'
)
SELECT 
    ST_AsGeoJSON(simplified_geometry) AS geojson,
    AVG(value) AS avg_value
FROM aggregated_geometries
GROUP BY grid_x, grid_y, simplified_geometry;
