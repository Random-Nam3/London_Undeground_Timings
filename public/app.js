document.addEventListener('DOMContentLoaded', () => {
    const stationSelect = document.getElementById('station-select');
    const calculateBtn = document.getElementById('calculate-btn');
    const resultsPanel = document.getElementById('results-panel');
    const timingsList = document.getElementById('timings-list');
    const startStationName = document.getElementById('start-station-name');
    const totalStations = document.getElementById('total-stations');
    const loadingOverlay = document.getElementById('loading-overlay');

    // Initialize Leaflet Map
    const map = L.map('map', {
        zoomControl: false // Move zoom control to bottom right later to avoid UI overlap
    }).setView([51.505, -0.1276], 12); // Center roughly on London

    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    // Dark Matter tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    let stationsMap = new Map(); // Store station data
    let markersMap = new Map(); // Store Leaflet markers
    let currentStartIndex = null;
    let showingTimes = false;

    // Fetch stations on load
    fetchStations();

    async function fetchStations() {
        try {
            const response = await fetch('/api/stations');
            if (!response.ok) throw new Error('Failed to fetch stations');
            const stations = await response.json();
            
            // Build map and dropdown
            stationSelect.innerHTML = '<option value="" disabled selected>Select a starting station...</option>';
            
            // Keep a sorted array for dropdown
            const sortedStations = [...stations].sort((a, b) => a.name.localeCompare(b.name));
            
            sortedStations.forEach(station => {
                const formattedName = formatStationName(station.name);
                
                // Add to dropdown
                const option = document.createElement('option');
                option.value = station.index;
                option.textContent = formattedName;
                stationSelect.appendChild(option);
            });

            // Plot markers
            stations.forEach(station => {
                stationsMap.set(station.index, station);
                
                // Create custom div icon
                const icon = L.divIcon({
                    className: 'station-marker',
                    html: `
                        <div class="marker-dot"></div>
                        <div class="marker-time"></div>
                    `,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20] // center the dot
                });

                const marker = L.marker([station.lat, station.long], { icon }).addTo(map);
                
                // Tooltip just for basic hover info (name)
                marker.bindTooltip(formatStationName(station.name), {
                    direction: 'top',
                    offset: [0, -10],
                    className: 'station-tooltip'
                });

                // Click marker to set as start station and calculate
                marker.on('click', () => {
                    stationSelect.value = station.index;
                    stationSelect.dispatchEvent(new Event('change'));
                    calculateTimings(station.index);
                });

                markersMap.set(station.index, marker);
            });
            
            stationSelect.disabled = false;
            
            // Draw lines after stations are plotted
            await fetchEdges();
        } catch (error) {
            console.error(error);
            stationSelect.innerHTML = '<option value="">Error loading stations</option>';
        }
    }

    async function fetchEdges() {
        try {
            const response = await fetch('/api/edges');
            if (!response.ok) throw new Error('Failed to fetch edges');
            const edges = await response.json();
            
            // Ensure lines are drawn behind markers
            map.createPane('edgesPane');
            map.getPane('edgesPane').style.zIndex = 300; 
            
            // A palette of vibrant, distinctive colors for the different lines
            const lineColors = [
                '#FF3366', '#33CCFF', '#FF9933', '#33FF99', '#CC33FF',
                '#FFFF33', '#FF3333', '#3333FF', '#33FF33', '#FF33CC',
                '#33FFFF', '#FFCC33', '#99FF33', '#9933FF', '#FF3399'
            ];

            edges.forEach(edge => {
                const fromStation = stationsMap.get(Number(edge.station1));
                const toStation = stationsMap.get(Number(edge.station2));
                
                if (fromStation && toStation) {
                    const layerNum = Number(edge.line) || 0;
                    const color = lineColors[layerNum % lineColors.length];
                    
                    L.polyline(
                        [[fromStation.lat, fromStation.long], [toStation.lat, toStation.long]], 
                        { 
                            color: color, 
                            weight: 3, 
                            opacity: 0.7,
                            pane: 'edgesPane'
                        }
                    ).addTo(map);
                }
            });
        } catch (error) {
            console.error("Error drawing lines:", error);
        }
    }

    stationSelect.addEventListener('change', () => {
        calculateBtn.disabled = !stationSelect.value;
        currentStartIndex = parseInt(stationSelect.value, 10);
    });

    calculateBtn.addEventListener('click', () => {
        if (currentStartIndex !== null) {
            calculateTimings(currentStartIndex);
        }
    });

    async function calculateTimings(selectedIndex) {
        if (selectedIndex === null || selectedIndex === undefined) return;

        // Show loading state
        resultsPanel.classList.add('hidden');
        loadingOverlay.classList.remove('hidden');
        calculateBtn.disabled = true;

        try {
            const response = await fetch(`/api/timings/${selectedIndex}`);
            if (!response.ok) throw new Error('Failed to calculate timings');
            const data = await response.json();
            
            renderTimingsList(data);
            updateMapMarkers(data);
            
            // Show results
            loadingOverlay.classList.add('hidden');
            resultsPanel.classList.remove('hidden');
            showingTimes = true;
        } catch (error) {
            console.error(error);
            alert('An error occurred while calculating timings.');
            loadingOverlay.classList.add('hidden');
        } finally {
            calculateBtn.disabled = false;
        }
    }

    function renderTimingsList(data) {
        startStationName.textContent = formatStationName(data.startStation.name);
        totalStations.textContent = `${data.routes.length} stations`;
        
        timingsList.innerHTML = '';
        
        data.routes.forEach((route, i) => {
            // Skip the starting station itself for the list
            if (route.time === 0 && route.index === data.startStation.index) return;

            const timeClass = getTimeClass(route.time);
            
            const item = document.createElement('div');
            item.className = 'timing-item';
            // Slight delay for stagger effect
            item.style.animation = `fadeIn 0.5s ease-out ${i * 0.01}s both`;
            
            // Compress changes into legs: Start -> Interchange -> Destination
            let legsHtml = '';
            if (route.changes && route.changes.length > 0) {
                let currentLegStart = formatStationName(data.startStation.name);
                let currentLine = route.changes[0].lineName;
                let currentColour = route.changes[0].lineColour;
                let sequence = [];
                
                for (let i = 1; i < route.changes.length; i++) {
                    let c = route.changes[i];
                    if (c.lineName !== currentLine) {
                        let interchange = formatStationName(route.changes[i-1].stationName);
                        
                        sequence.push(`<span class="station-node">${currentLegStart}</span>`);
                        sequence.push(`
                            <div class="route-arrow-container">
                                <span class="route-line-label" style="color: #${currentColour}">${currentLine}</span>
                                <span class="route-arrow" style="color: #${currentColour}">→</span>
                            </div>
                        `);
                        
                        currentLegStart = interchange;
                        currentLine = c.lineName;
                        currentColour = c.lineColour;
                    }
                }
                
                // Final leg
                sequence.push(`<span class="station-node">${currentLegStart}</span>`);
                sequence.push(`
                    <div class="route-arrow-container">
                        <span class="route-line-label" style="color: #${currentColour}">${currentLine}</span>
                        <span class="route-arrow" style="color: #${currentColour}">→</span>
                    </div>
                `);
                sequence.push(`<span class="station-node">${formatStationName(route.name)}</span>`);
                
                legsHtml = `<div class="route-changes">${sequence.join('')}</div>`;
            }

            item.innerHTML = `
                <div class="station-info">
                    <div class="station-name">${formatStationName(route.name)}</div>
                    ${legsHtml}
                </div>
                <div class="time-value ${timeClass}">
                    ${route.time} <span class="time-unit">mins</span>
                </div>
            `;
            
            timingsList.appendChild(item);
        });
    }

    function updateMapMarkers(data) {
        // Reset all markers first
        markersMap.forEach(marker => {
            const el = marker.getElement();
            if (el) {
                el.className = 'leaflet-marker-icon leaflet-zoom-animated leaflet-interactive station-marker';
                const timeEl = el.querySelector('.marker-time');
                if (timeEl) timeEl.textContent = '';
            }
        });

        // Update with new times
        data.routes.forEach(route => {
            const marker = markersMap.get(route.index);
            if (!marker) return;

            const el = marker.getElement();
            if (el) {
                // Determine class
                let cssClass = 'show-times ';
                if (route.index === data.startStation.index) {
                    cssClass += 'is-start';
                } else {
                    cssClass += getTimeClass(route.time);
                }
                
                // Add classes
                el.className = `leaflet-marker-icon leaflet-zoom-animated leaflet-interactive station-marker ${cssClass}`;
                
                // Update time text
                const timeEl = el.querySelector('.marker-time');
                if (timeEl) {
                    timeEl.textContent = route.index === data.startStation.index ? 'Start' : `${route.time}m`;
                }
            }
        });

        // Pan map to start station
        const startStation = stationsMap.get(data.startStation.index);
        if (startStation) {
            map.flyTo([startStation.lat, startStation.long], 13, {
                duration: 1.5
            });
        }
    }

    function getTimeClass(time) {
        if (time < 10) return 'time-fast';
        if (time < 20) return 'time-medium';
        if (time < 30) return 'time-slow';
        return 'time-v-slow';
    }

    function formatStationName(name) {
        if (!name) return '';
        return name
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/\(.*\)/, match => ` ${match}`)
            .split(/[\s-]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
});
