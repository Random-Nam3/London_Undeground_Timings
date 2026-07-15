# London Underground Timings 🚇

An interactive full-stack application that visualizes travel times across the entire London Underground network. 

Built with Node.js and TypeScript, this project implements a custom pathfinding algorithm (Dijkstra's) to calculate the shortest routes between all 369 stations in London. The calculations are presented via a sleek, interactive map UI using Leaflet.js and premium dark-mode glassmorphism styling.

## Features ✨

* **Custom Pathfinding Engine**: Implements Dijkstra's algorithm to compute shortest paths instantly across the Tube network.
* **Interactive Network Map**: Visualizes the geography of all London stations and Tube lines natively on a sleek dark-themed map (CartoDB Dark Matter) using Leaflet.js.
* **Dynamic Visualization**: Click on any station on the map to instantly re-calculate routes. Map markers automatically update their colors (Green/Yellow/Red) and display travel times based on distance.
* **Zero-Dependency API**: The backend is built completely with Node.js native `http` module—no heavy web frameworks required.

## Getting Started 🚀

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/london-underground-timings.git
   cd london-underground-timings
   ```
2. Install the necessary dependencies (like `tsx` and `csv-parse`):
   ```bash
   npm install
   ```

### Running the App
Start the application by running:
```bash
npm run serve
```
Then, open your web browser and navigate to `http://localhost:3000` to interact with the map!

## Data Sources 📊
The application calculates routes based on graph data (`nodes.csv` and `edges.csv`) representing real London Underground stations, coordinates, and network connections.

**Dataset Credit:**
The network data used in this project is provided by:
> Manlio De Domenico, Albert Solé-Ribalta, Sergio Gómez, and Alex Arenas, "Navigability of interconnected networks under random failures." *PNAS 111*, 8351-8356 (2014)  
> Dataset available at: [https://manliodedomenico.com/data.php](https://manliodedomenico.com/data.php)


## Roadmap (To Do) 📝
- **Combine Stations**: Merge complex interchange stations (e.g., Bank and Monument) to improve routing accuracy.
- **Add Route Providers**: Integrate external routing APIs or real-time providers to offer alternative path options.
- **Check Service Availability**: Fetch live TfL status updates to dynamically block out closed lines or stations.
