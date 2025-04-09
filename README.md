# geoparquet-backend
Express API on top of GeoParquet file 

The GeoParquet file MUST contains at least :
* a "geometry" column
* a "time" column
* a "value" column

## Build

    docker compose build

## Deploy
Move your geoparquet file to the data directory (e.g. MyParquetFile.parquet). Then:

Using docker run:

    docker run -v ${PWD}/data:/data -e GEOPARQUET_FILE="/data/MyParquetFile.parquet" -it jjrom/geoparquet-backend

Using docker compose:

    # [IMPORTANT] First set the GEOPARQUET_FILE value in docker-compose.yml
    docker compose up

# Usage
To get output in GeoJSON

    curl http://localhost:3001/geojson/:timestamp

To get output in Geoarrow

    curl http://localhost:3001/geoarrow/:timestamp

In both case, ":timestamp" should be replaced by an ISO date corresponding to an existing timestamp within the geoparquet file (e.g. 2025-03-01)

