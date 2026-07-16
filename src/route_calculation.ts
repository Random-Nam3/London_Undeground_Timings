import { parse } from "csv-parse/sync";
import { PriorityQueue } from "@datastructures-js/priority-queue"
import fs from "fs";
import path from "path";

type connection = {
    station1: number;
    station2: number;
    time: number;
    line: number;
}

export type change = {
    station: number,
    line: number
}

type route = {
    changes: change[],
    time: number
}

const EDGE_FILE_PATH = path.resolve(__dirname, "../graph/london.connections.csv");
const STATION_LINE_FILE_PATH = path.resolve(__dirname, "../graph/london.station_lines.csv");

export class Station {
    name: string;
    index: number;
    toStationRoutes: Map<number, route>;

    constructor(name: string, index: number) {
        this.name = name;
        this.index = index;
        this.toStationRoutes = new Map<number, route>();
    }

    async calculateRoutes() {
        const graph: connection[] = await this.getGraph()

        type queueItem = {
            stationIndex: number,
            timeToReach: number,
            changes: change[]
        };
        let priorityQueue: PriorityQueue<queueItem> = new PriorityQueue((a, b) => {
            if (a.timeToReach <= b.timeToReach) return -1;
            return 1
        })

        priorityQueue.enqueue({ stationIndex: this.index, timeToReach: 0, changes: [] });

        while (!priorityQueue.isEmpty()) {
            let cur = priorityQueue.dequeue();
            if (!cur || this.toStationRoutes.has(cur.stationIndex)) {
                continue
            }

            this.toStationRoutes.set(cur.stationIndex, {
                time: cur.timeToReach,
                changes: cur.changes
            });

            for (let edge of graph) {
                if (edge.station1 === cur.stationIndex && !this.toStationRoutes.has(edge.station2)) {
                    let newTime = cur.timeToReach + edge.time;
                    if (cur.changes.length > 0 && cur.changes[cur.changes.length - 1].line !== edge.line) {
                        newTime += 4;
                    }
                    priorityQueue.enqueue({ stationIndex: edge.station2, timeToReach: newTime, changes: [...cur.changes, { station: edge.station2, line: edge.line }] });
                }
                if (edge.station2 === cur.stationIndex && !this.toStationRoutes.has(edge.station1)) {
                    let newTime = cur.timeToReach + edge.time;
                    if (cur.changes.length > 0 && cur.changes[cur.changes.length - 1].line !== edge.line) {
                        newTime += 4;
                    }
                    priorityQueue.enqueue({ stationIndex: edge.station1, timeToReach: newTime, changes: [...cur.changes, { station: edge.station1, line: edge.line }] });
                }
            }
        }
    }

    async getGraph(): Promise<connection[]> {
        const fileContent = fs.readFileSync(EDGE_FILE_PATH, "utf8");
        const headers = ["station1", "station2", "line", "time"]

        const records: { station1: number, station2: number, line: number, time: number }[] = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            comment: "#",
            relax_quotes: true,
        });

        return records.map(record => {
            return {
                station1: Number(record.station1),
                station2: Number(record.station2),
                time: Number(record.time),
                line: Number(record.line)
            } as connection
        })
    }

    async getStationLines(): Promise<Map<number, Set<number>>> {
        const fileContent = fs.readFileSync(STATION_LINE_FILE_PATH, "utf8");
        const headers = ["station", "lines"]

        const records: { station: number, lines: string }[] = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            comment: "#",
            relax_quotes: true,
        });

        return new Map(records.map(record => {
            return [
                Number(record.station),
                new Set(record.lines.split("+").map(Number))
            ] as [number, Set<number>]
        }))
    }
}