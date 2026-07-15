import path from "path";
import { parse } from "csv-parse/sync";
import fs from "fs";
import { Station } from "./index";


const STATION_FILE_PATH = path.resolve(__dirname, "../graph/nodes.csv");

function mapStations(): Map<number, string> {
    const fileContent = fs.readFileSync(STATION_FILE_PATH, "utf8");
    const headers = ["index", "name", "nodeLabel", "nodeLat", "nodeLong", "_pos"];

    const records: { index: number, name: string, nodeLabel: string, nodeLat: number, nodeLong: number, _pos: string }[] = parse(fileContent, {
        columns: headers,
        skip_empty_lines: true,
        comment: "#",
        relax_quotes: true,
    });

    let stationMap = new Map<number, string>();
    for (let record of records) {
        stationMap.set(Number(record.index), record.name);
    }
    return stationMap;
}


async function run() {
    let bank = new Station("bank", 34);
    await bank.calculateTimings();
    let timings = bank.toStationTimings;
    let stationNameMap = mapStations();

    for (let [stationIndex, time] of timings) {
        console.log(`${stationNameMap.get(stationIndex)}: ${time}`);
    }
}

run();