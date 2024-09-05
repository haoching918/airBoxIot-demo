class Map {
	// map setting
	zoom = 8
	latlng = L.latLng(23.5, 121);
	// base map
	OpenStreetMap_Mapnik = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
	});
	Stamen_Terrain = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.{ext}', {
		attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		subdomains: 'abcd',
		minZoom: 0,
		maxZoom: 18,
		ext: 'png'
	});
	constructor(data) {
		this.timeDevicesData = data;
		this.airBoxPoints = []
		this.timeDevicesData.data.forEach(d => {
			if (d.gps_lon < 122.015 && d.gps_lon > 118.2 && d.gps_lat < 26.4 && d.gps_lat > 21.8 && d["pm2.5"] < 100) {
				this.airBoxPoints.push(L.marker([d.gps_lat, d.gps_lon]).bindPopup(d.siteName).on('click', function () {
					getDevice(d.deviceId)
				})) // create marker layer for device
			}
		})
		this.airBox = L.layerGroup(this.airBoxPoints)

		// create map
		this.map = L.map('map', { layers: [this.OpenStreetMap_Mapnik] }).setView(this.latlng, this.zoom)

		// base & overlay layer for layerControl
		this.baseMaps = {
			"街道圖": this.OpenStreetMap_Mapnik,
			"地形圖": this.Stamen_Terrain,
		};
		this.overlayMaps = {
			"空氣盒子站點": this.airBox,
		};
		this.layerControl = L.control.layers(this.baseMaps, this.overlayMaps, { position: 'bottomright' }).addTo(this.map)
		this.drawLegend()
		this.drawSvg(this.map, `${this.timeDevicesData.timeStamp}-${String(this.timeDevicesData.timeScale).padStart(2, "0")}`)
	}
	update_image(imageUrl) {
		this.imageLayer.setUrl(imageUrl)
	}

	drawSvg(map, timeStampStr) {
		let svgLayer = L.svg();
		// svgLayer.addTo(map)
		let svg = d3.select('#svgele').attr('id', 'svgele');
		d3.json("./taiwanTopo.json").then(function (topology) {
			// Convert topojson to geojson
			let geojson = topojson.feature(topology, topology.objects.map); // replace 'yourObject' with your topojson object
			let transform = d3.geoTransform({ point: projectPoint });
			let path = d3.geoPath().projection(transform);
			let sw = map.latLngToLayerPoint(new L.LatLng(21.895, 118.21)), ne = map.latLngToLayerPoint(new L.LatLng(26.5, 123.5))

			let pro = d3.geoMercator()
				.fitExtent([[0, 0], [800, 800]], geojson);
			let geoGenerator = d3.geoPath()
				.projection(pro);
			var bound = [118.21, 123.5, 21.895, 26.5];
			var bound_ul = pro([bound[0], bound[3]]), bound_dr = pro([bound[1], bound[2]])
			var imgWidth = bound_dr[0] - bound_ul[0];
			var imgHeight = bound_dr[1] - bound_ul[1];
			svg.append("clipPath")
				.attr("id", "clip")
				.selectAll("path")
				.data(geojson.features)
				.enter()
				.append("path")
				.attr("d", geoGenerator);

			svg.append("image")
				.attr('id', 'img')
				.attr("xlink:href", `/interpolate_image/${timeStampStr}.png`)
				.attr("x", bound_ul[0])
				.attr("y", bound_ul[1] + 5)
				.attr("width", imgWidth)
				.attr("height", imgHeight)
				.attr('opacity', 0.7)
				.attr("clip-path", "url(#clip)")

			// map.on("zoom", zoom);


			function zoom() {
				svg.select('#clip').attr('transform', transform)
				svg.select('#img').attr('transform', transform)
			}

			function projectPoint(lon, lat) {
				let point = map.latLngToLayerPoint(new L.LatLng(lat, lon));
				this.stream.point(point.x, point.y);
			}
		});
		var svgElement = document.querySelector('#svgele')
		var latLngBounds = L.latLngBounds([[21.73063921314905, 118.21459926092473], [26.54207398238185, 123.48914460761736]]);
		map.fitBounds(latLngBounds);

		var svgOverlay = L.svgOverlay(svgElement, latLngBounds, {
			opacity: 1,
			interactive: true
		}).addTo(map);
		this.layerControl.addOverlay(svgOverlay, "內插圖")
	}
	updateIdw(url) {
		d3.select('#svgele').select('#img')
			.attr('xlink:href', url)

	}
	drawLegend() {
		var legend = L.control({ position: "bottomleft" });
		var div = L.DomUtil.create('div', 'info legend')
		var grades = [0, 11, 23, 35, 41, 47, 53, 58, 64, 70];
		legend.onAdd = function (map) {
			div.innerHTML += "<h4>PM2.5指標對照表</h4>";
			for (var i = 0; i < grades.length; i++) {
				div.innerHTML += "<i style= background:" + getColor(grades[i] + 1) + "></i> " + grades[i] + (grades[i + 1] ? "&ndash;" + grades[i + 1] + "<br>" : "+");
			}
			return div;
		}
		legend.addTo(this.map);
	}
}
function animate() {
	var date = startDate
	var time = newTime + 1
	var total = 24 / timeScale
	var filename = []
	for (let i = 0; i < total * 7; i++) {
		setCurDate(date.yyyymmdd(), time)
		let path = "./interpolate_image/" + date.yyyymmdd() + "-" + (time > 9 ? time : "0" + time) + ".png"
		filename.push(path)
		if (++time == total)
			date = date.addDays(1)
		time %= total
	}
	var index = 0
	setInterval(function () {
		if (index >= filename.length) {
			return
		}
		myMap.updateIdw(filename[index])
		++index
	}, 41);
}
function updateCurDateIdw() {
	var date = document.getElementById("dateSelector").value
	var time = document.getElementById("timeSelector").value
	if (!validTime(date, time)) {
		alert("Invalid date")
		return
	}
	let path = "./interpolate_image/" + date + "-" + (time > 9 ? time : "0" + time) + ".png"
	myMap.updateIdw(path)
}
async function getDevice(deviceId) {
	var response = await fetch(`./data/discretized_device_week/${deviceId}.json`)
	var deviceWeekData = await response.json()
	myChart.setData(deviceWeekData)
}
function predict() {
	let nextDate = newDate.addHours(1)
	var time = (newTime + 1) % (24 / timeScale)
	let path = "./interpolate_image/" + nextDate.yyyymmdd() + "-" + (time > 9 ? time : "0" + time) + ".png"
	myMap.updateIdw(path)
}
function getColor(x) {
	return x < 11 ? '#9CFF9C' :
		x < 23 ? '#31FF00' :
			x < 35 ? '#31CF00' :
				x < 41 ? '#FFFF00' :
					x < 47 ? '#FFCF00' :
						x < 53 ? '#FF9A00' :
							x < 58 ? '#FF6464' :
								x < 64 ? '#FF0000' :
									x < 70 ? '#990000' :
										'#CE30FF'
}

class Linechart {
	deviceWeekData
	chart

	constructor(deviceWeekData) {
		this.deviceWeekData = deviceWeekData
		let chartData = {
			labels: [],
			datasets: [
				{
					label: "",
					data: [],
					fill: false,
					borderColor: "rgb(75, 192, 192)",
				},
				{
					label: "",
					data: [],
					fill: false,
					borderColor: "rgb(200, 0, 0)",
				},
			],
		}
		let config = {
			type: 'line',
			data: chartData,
			options: {
				responsive: true,
				maintainAspectRatio: false,
				layout: {
					padding: {
						top: 15,
					}
				},
				plugins: {
					legend: {
						position: 'top',
					},
					title: {
						display: true,
						text: "",
						color: 'black',
						font: {
							family: 'Times',
							size: 20,
							style: 'normal',
							lineHeight: 0
						}
					}
				},
				scales: {
					x: {
						display: true,
						title: {
							display: true,
							text: '時間',
							color: 'black',
							font: {
								family: 'Times',
								size: 20,
								style: 'normal',
								lineHeight: 1.2
							},
							padding: { top: 20, left: 0, right: 0, bottom: 0 }
						}
					},
					y: {
						display: true,
						title: {
							display: true,
							text: '數值',
							color: 'black',
							font: {
								family: 'Times',
								size: 20,
								style: 'normal',
								lineHeight: 1.2,
							},
							padding: { top: 20, left: 0, right: 0, bottom: 0 }
						}
					}
				}
			},
		};
		this.chart = new Chart(document.getElementById("myChart"), config)
		this.setTimeScale()
	}
	setTimeScale() {
		let labels = []
		let pmData = []
		let tempData = []
		let humidData = []
		for (let date = startDate; date.getTime() < newDate.getTime(); date = date.addHours(timeScale)) {
			let dateStr = date.yyyymmdd()
			let timeStr = String(date.getHours() / timeScale)
			//labels.push(timeStr == "0" ? dateStr.slice(5) : timeStr)
			labels.push(dateStr.slice(5) + " " + timeStr)
			pmData.push(this.deviceWeekData.data[dateStr][timeStr]["avgPm2.5"])
			tempData.push(this.deviceWeekData.data[dateStr][timeStr].avgTemperature)
			// humidData.push(this.deviceWeekData.data[dateStr][timeStr].avgHumidity)
		}
		this.chart.options.plugins.title.text = this.deviceWeekData.siteName
		let chartData = this.chart.data
		chartData.labels = labels
		chartData.datasets[0].data = pmData
		chartData.datasets[0].label = "7 days PM2.5 （μg/m3）"
		chartData.datasets[1].data = tempData
		chartData.datasets[1].label = "7 days temperature ℃"
		// chartData.datasets[2].data = humidData
		// chartData.datasets[2].label = this.timeLabels[timeScale] + " humidity （RH）"

		this.chart.update()
	}
	setData(deviceWeekData) {
		this.deviceWeekData = deviceWeekData
		this.setTimeScale()
	}
	maxDate(date1, date2) {
		return date1.getTime() > date2.getTime() ? date1 : date2
	}

}
// function updateChartTime1() {
// 	myChart.setTimeScale(1)
// }
// function updateChartTime3() {
// 	myChart.setTimeScale(3)
// }
// function updateChartTime7() {
// 	myChart.setTimeScale(7)
// }

function genDate(delimiter, dateStr, curTime) {
	var splitDateStr = dateStr.split(delimiter)
	return new Date(splitDateStr[0], splitDateStr[1] - 1, splitDateStr[2], curTime * timeScale + timeScale)
}
function validTime(dateStr, time) {
	var date = genDate("-", dateStr, time)
	if (date.getTime() <= startDate.getTime() || date.getTime() > newDate.getTime()) return false

	return true
}
// set cur date at html
function setCurDate(dateStr, time) {
	var dateSelector = document.getElementById("dateSelector")
	dateSelector.value = dateStr

	var timeSelector = document.getElementById("timeSelector")
	timeSelector.value = String(time)
}
function initSelector() {
	// init date selector
	var dateSelector = document.getElementById("dateSelector")
	dateSelector.max = newDate.yyyymmdd()
	dateSelector.min = newDate.addDays(-7).yyyymmdd()
	document.getElementById("last_update").innerHTML = `最後更新時間 ${dateTimeStr} GMT+0`

	var selector = document.getElementById("timeSelector");
	// Create an array of options
	var options = [];
	for (let i = 0; i < 24 / timeScale; ++i) {
		var tmp = {};
		tmp["value"] = i;
		tmp["text"] = i;
		options.push(tmp)
	}

	// Generate the options dynamically
	for (var i = 0; i < options.length; i++) {
		var option = document.createElement("option");
		option.value = options[i].value;
		option.text = options[i].text;
		selector.appendChild(option);
	}
}

async function fetch_json(path) {
	var response = await fetch(path)
	var r = await response.json()
	return r
}
Date.prototype.addDays = function (days) {
	const date = new Date(this.valueOf())
	date.setDate(date.getDate() + days)
	return date
}
Date.prototype.addHours = function (hours) {
	const date = new Date(this.valueOf())
	date.setHours(date.getHours() + hours)
	return date
}
Date.prototype.yyyymmdd = function () {
	var mm = this.getMonth() + 1; // getMonth() is zero-based
	var dd = this.getDate();

	return [this.getFullYear(),
	(mm > 9 ? '' : '0') + mm,
	(dd > 9 ? '' : '0') + dd
	].join('-');
};

var info = await fetch_json("./info.json")
var dateTimeStr = info["update_datetime"]
var timeScale = info["time_scale"]
var newDateStr = dateTimeStr.slice(0, 10) // yyyy-mm-dd
var newTime = ~~(parseInt(dateTimeStr.slice(11, 13)) / timeScale) - 1 // 0-7 int
var newDate = genDate("-", newDateStr, newTime)
var startDate = newDate.addDays(-7)

setCurDate(newDateStr, newTime)
initSelector()

var timeDevicesData = await fetch_json("./data/time_week/" + newDateStr + "-" + (newTime >= 10 ? String(newTime) : ("0" + String(newTime))) + ".json")
var deviceWeekData = await fetch_json("./data/discretized_device_week/74DA38E69B2E.json")


var myMap = new Map(timeDevicesData)
var myChart = new Linechart(deviceWeekData)
myChart.chart.canvas.onclick = function (evt) {
	var activePoint = myChart.chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, false)
	var dataIndex = activePoint[0].index
	var dateStr = myChart.chart.data.labels[dataIndex] // mm-dd t
	setCurDate(`${newDateStr.slice(0, 4)}-${dateStr.slice(0, 5)}`, parseInt(dateStr.slice(6)))
	updateCurDateIdw()
}

document.getElementById('submitDate').onclick = updateCurDateIdw
document.getElementById('playAnimation').onclick = animate
document.getElementById('predict').onclick = predict

//// Resize functionality
var resizer = document.getElementById("resizer");
var mapContainer = document.getElementById("map-container")
var chartContainer = document.getElementById("chart-container")

var isResizing = false;
var startX = 0;
var startWidth = 0;

resizer.addEventListener('mousedown', function (e) {
	e.preventDefault();
	isResizing = true;
	startX = e.clientX;
	startWidth = mapContainer.offsetWidth;
});

document.addEventListener('mousemove', function (e) {
	if (!isResizing) return;
	var width = startWidth + (e.clientX - startX);
	mapContainer.style.width = width + 'px';
	width += 50
	chartContainer.style.left = width + 'px'
	myMap.map.invalidateSize();
	myChart.chart.resize()
});

document.addEventListener('mouseup', function () {
	isResizing = false;
});