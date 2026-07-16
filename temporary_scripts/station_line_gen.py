import csv
import os

print("Creating a csv file that has the lines for each station index")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_FILE_PATH = os.path.join(BASE_DIR, "graph", "london.station_lines.csv")
INPUT_FILE_PATH = os.path.join(BASE_DIR, "graph", "london.connections.csv")

station_lines = {}

with open(INPUT_FILE_PATH, 'r') as f:
    reader = csv.reader(f)
    next(reader)
    for row in reader:
        if row[0] not in station_lines:
            station_lines[row[0]] = set()
        station_lines[row[0]].add(row[2])
        if row[1] not in station_lines:
            station_lines[row[1]] = set()
        station_lines[row[1]].add(row[2])

with open(OUTPUT_FILE_PATH, 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(["station", "lines"])
    for station, lines in station_lines.items():
        writer.writerow([station, "+".join(sorted(list(lines)))])

print("Done!")

