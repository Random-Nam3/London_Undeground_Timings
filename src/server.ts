import http from 'http';
import path from 'path';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { change, Station } from './route_calculation';

const STATION_FILE_PATH = path.resolve(__dirname, '../graph/london.stations.csv');
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const LINE_FILE_PATH = path.resolve(__dirname, '../graph/london.lines.csv');

// Cache the stations
let cachedStations: any[] = [];
let stationNameMap = new Map<number, string>();
let lineNameMap = new Map<number, { name: string, colour: string }>();

function loadStations() {
    if (cachedStations.length > 0) return;
    const fileContent = fs.readFileSync(STATION_FILE_PATH, 'utf8');
    const records: { id: number, latitude: number, longitude: number, name: string, display_name: string, zone: number, total_lines: number, rail: number }[] = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        comment: "#",
        relax_quotes: true,
    });

    cachedStations = records.map(r => ({
        index: Number(r.id),
        name: r.name,
        lat: Number(r.latitude),
        long: Number(r.longitude)
    }));

    for (let record of records) {
        stationNameMap.set(Number(record.id), record.name);
    }
}

function convertChanges(changes: change[]) {
    loadLines();
    loadStations();
    let newChanges: {
        stationName: string,
        lineName: string,
        lineColour: string
    }[] = [];
    for (let change of changes) {
        let lineInfo = lineNameMap.get(change.line);
        newChanges.push({
            stationName: stationNameMap.get(change.station) || 'Unknown',
            lineName: lineInfo ? lineInfo.name : 'Unknown',
            lineColour: lineInfo ? lineInfo.colour : 'FFFFFF'
        });
    }
    return newChanges;
}

function loadLines() {
    if (lineNameMap.size > 0) return;
    const fileContent = fs.readFileSync(LINE_FILE_PATH, 'utf8');
    const records: { line: number, name: string, colour: string }[] = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        comment: "#",
        relax_quotes: true,
    });

    for (let record of records) {
        lineNameMap.set(Number(record.line), { name: record.name, colour: record.colour });
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
            const edgeContent = fs.readFileSync(path.resolve(__dirname, '../graph/london.connections.csv'), 'utf8');
            const edges = parse(edgeContent, {
                columns: true,
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
            await station.calculateRoutes();

            const routes = Array.from(station.toStationRoutes.entries()).map(([index, route]) => {
                return {
                    index,
                    name: stationNameMap.get(index) || 'Unknown',
                    changes: convertChanges(route.changes),
                    time: route.time
                };
            });

            // Sort by time ascending
            routes.sort((a, b) => a.time - b.time);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                startStation: { index: startIndex, name: startStationName },
                routes
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
            if (error.code == 'ENOENT') {
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
