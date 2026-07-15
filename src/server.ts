import http from 'http';
import path from 'path';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { Station } from './index';

const STATION_FILE_PATH = path.resolve(__dirname, '../graph/nodes.csv');
const PUBLIC_DIR = path.resolve(__dirname, '../public');

// Cache the stations
let cachedStations: any[] = [];
let stationNameMap = new Map<number, string>();

function loadStations() {
    if (cachedStations.length > 0) return;
    const fileContent = fs.readFileSync(STATION_FILE_PATH, 'utf8');
    const headers = ["index", "name", "nodeLabel", "nodeLat", "nodeLong", "_pos"];
    const records: { index: number, name: string, nodeLabel: string, nodeLat: number, nodeLong: number, _pos: string }[] = parse(fileContent, {
        columns: headers,
        skip_empty_lines: true,
        comment: "#",
        relax_quotes: true,
    });
    
    cachedStations = records.map(r => ({
        index: Number(r.index),
        name: r.name,
        lat: Number(r.nodeLat),
        long: Number(r.nodeLong)
    }));

    for (let record of records) {
        stationNameMap.set(Number(record.index), record.name);
    }
}

const server = http.createServer(async (req, res) => {
    // Basic CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (req.url === '/api/stations' && req.method === 'GET') {
        loadStations();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cachedStations));
        return;
    }

    if (req.url === '/api/edges' && req.method === 'GET') {
        try {
            const edgeContent = fs.readFileSync(path.resolve(__dirname, '../graph/edges.csv'), 'utf8');
            const edges = parse(edgeContent, {
                columns: ["from", "to", "weight", "layer"],
                skip_empty_lines: true,
                comment: "#",
                relax_quotes: true,
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(edges));
        } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    if (req.url?.startsWith('/api/timings/') && req.method === 'GET') {
        try {
            loadStations();
            const startIndex = Number(req.url.split('/').pop());
            const startStationName = stationNameMap.get(startIndex);
            if (!startStationName) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Station not found' }));
                return;
            }

            const station = new Station(startStationName, startIndex);
            await station.calculateTimings();

            const timings = Array.from(station.toStationTimings.entries()).map(([index, time]) => {
                return {
                    index,
                    name: stationNameMap.get(index) || 'Unknown',
                    time
                };
            });

            // Sort by time ascending
            timings.sort((a, b) => a.time - b.time);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                startStation: { index: startIndex, name: startStationName },
                timings
            }));
        } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Static file serving
    let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url || 'index.html');
    
    // Security Check: Prevent Directory Traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end('403 Forbidden: Cannot access files outside the public directory');
        return;
    }
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.json': contentType = 'application/json'; break;
        case '.png': contentType = 'image/png'; break;
        case '.jpg': contentType = 'image/jpg'; break;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code == 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
