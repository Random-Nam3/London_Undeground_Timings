import path from "path";
import { parse } from "csv-parse/sync";
import fs from "fs";
import { Station } from "./route_calculation";

const STATION_FILE_PATH = path.resolve(__dirname, "../graph/london.stations.csv");
const LINE_FILE_PATH = path.resolve(__dirname, "../graph/london.lines.csv");

function mapStations(): Map<number, string> {
    const fileContent = fs.readFileSync(STATION_FILE_PATH, "utf8");
    const records: { id: number, name: string }[] = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        comment: "#",
        relax_quotes: true,
    });

    let stationMap = new Map<number, string>();
    for (let record of records) {
        stationMap.set(Number(record.id), record.name);
    }
    return stationMap;
}

function mapLines(): Map<number, string> {
    const fileContent = fs.readFileSync(LINE_FILE_PATH, "utf8");
    const records: { line: number, name: string }[] = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        comment: "#",
        relax_quotes: true,
    });

    let lineMap = new Map<number, string>();
    for (let record of records) {
        lineMap.set(Number(record.line), record.name);
    }
    return lineMap;
}

async function run() {
    // Bank station index is 13
    let bank = new Station("Bank", 13);
    await bank.calculateRoutes();
    let routes = bank.toStationRoutes;
    let stationNameMap = mapStations();
    let lineNameMap = mapLines();

    console.log(`=== Routes from Bank ===`);
    let count = 0;
    for (let [stationIndex, route] of routes) {
        if (count > 15) break; // just print first 15 so we don't spam terminal
        if (stationIndex === 13) continue;
        
        const destName = stationNameMap.get(stationIndex) || "Unknown";
        const uniqueLines = [];
        let lastLine = null;
        for (let change of route.changes) {
            const lineName = lineNameMap.get(change.line) || "Unknown";
            if (lineName !== lastLine) {
                uniqueLines.push(lineName);
                lastLine = lineName;
            }
        }
        console.log(`To ${destName}: ${route.time} mins | via [${uniqueLines.join(' -> ')}]`);
        count++;
    }
}

run();