import { parse } from "csv-parse/sync";
import { PriorityQueue } from "@datastructures-js/priority-queue"
import fs from "fs";
import path from "path";

type connection = {
    from: number;
    to: number;
    time: number;
}

const EDGE_FILE_PATH = path.resolve(__dirname, "../graph/edges.csv");

export class Station {
    name: string;
    index: number;
    toStationTimings: Map<number, number>;

    constructor(name: string, index: number) {
        this.name = name;
        this.index = index;
        this.toStationTimings = new Map<number, number>();
    }

    async calculateTimings() {
        const graph: connection[] = await this.getGraph()

        type queueItem = {
            stationIndex: number,
            timeToReach: number
        };
        let priorityQueue: PriorityQueue<queueItem> = new PriorityQueue((a, b) => {
            if (a.timeToReach <= b.timeToReach) return -1;
            return 1
        })

        priorityQueue.enqueue({ stationIndex: this.index, timeToReach: 0 });

        while (!priorityQueue.isEmpty()) {
            let cur = priorityQueue.dequeue();
            if (!cur || this.toStationTimings.has(cur.stationIndex)) {
                continue
            }

            this.toStationTimings.set(cur.stationIndex, cur.timeToReach);

            for (let edge of graph) {
                if (edge.from === cur.stationIndex && !this.toStationTimings.has(edge.to)) {
                    let newTime = cur.timeToReach + edge.time;
                    priorityQueue.enqueue({ stationIndex: edge.to, timeToReach: newTime });
                }
                if (edge.to === cur.stationIndex && !this.toStationTimings.has(edge.from)) {
                    let newTime = cur.timeToReach + edge.time;
                    priorityQueue.enqueue({ stationIndex: edge.from, timeToReach: newTime });
                }
            }
        }
    }

    async getGraph(): Promise<connection[]> {
        const fileContent = fs.readFileSync(EDGE_FILE_PATH, "utf8");
        const headers = ["from", "to", "weight", "layer"]

        const records: { from: number, to: number, weight: number, layer: string }[] = parse(fileContent, {
            columns: headers,
            skip_empty_lines: true,
            comment: "#",
            relax_quotes: true,
        });

        return records.map(record => {
            return {
                from: Number(record.from),
                to: Number(record.to),
                time: Number(record.weight)
            } as connection
        })
    }
}