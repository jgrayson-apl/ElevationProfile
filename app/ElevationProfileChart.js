/**
 *
 * ElevationProfileChart
 *  - Create elevation profile over a path
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  3/13/2019 - 0.0.1 -
 * Modified:
 *
 */
define([
  "esri/core/watchUtils",
  "esri/core/Accessor",
  "esri/core/Evented",
  "dojo/number",
  "esri/views/SceneView",
  "esri/geometry/Polyline",
  "esri/geometry/geometryEngine"
], function (watchUtils, Accessor, Evented, number, SceneView, Polyline, geometryEngine) {

  const ElevationProfileChart = Accessor.createSubclass([Evented], {
    declaredClass: "ElevationProfileChart",

    properties: {
      view: {
        type: SceneView
      },
      container: {
        type: HTMLDivElement | String,
        set: function (value) {
          this._set("container", (value instanceof HTMLDivElement) ? value : document.getElementById(value));
          // CHART //
          this._initializeChart();
          // DETAILS NODE //
          this._detailsNode = document.createElement("div");
          this._detailsNode.classList.add("profile-details", "icon-ui-description", "font-size--3", "avenir-italicX", "icon-ui-yellow");
          this.container.append(this._detailsNode);
        }
      },
      _detailsNode: {
        type: HTMLDivElement
      },
      _profileChart: {
        type: Object
      },
      _default_infos: {
        type: Array,
        readOnly: true
      },
      _profile_infos: {
        type: Array
      },
      min_point_count: {
        type: Number
      }
    },

    /**
     *
     */
    constructor: function () {

      this.min_point_count = 250;

      this._profile_infos = this._default_infos = [
        { x: 0, y: 100 },
        { x: 33, y: 500 },
        { x: 50, y: 1000 },
        { x: 66, y: 500 },
        { x: 100, y: 100 }
      ];

    },

    /**
     *
     */
    _initializeChart: function () {

      require([
        "dojo/on",
        "dojo/number",
        "dojo/_base/Color",
        "dojo/colors",
        "dojox/charting/Chart",
        "dojox/charting/axis2d/Default",
        "dojox/charting/plot2d/Grid",
        "dojox/charting/themes/Bahamation",
        "dojox/charting/plot2d/Areas",
        "dojox/charting/action2d/MouseIndicator",
      ], (on, number, Color, colors, Chart, Default, Grid, ChartTheme, Areas, MouseIndicator) => {

        const fontColor = "#fff";
        const lineStroke = { color: "#fff", width: 1.5 };

        ChartTheme.indicator.lineStroke = { color: "#0079c1", width: 3.0 };

        this._profileChart = new Chart(this.container, {
          margins: { l: 10, t: 25, r: 10, b: 10 }
        });
        this._profileChart.setTheme(ChartTheme);
        this._profileChart.fill = this._profileChart.theme.plotarea.fill = "transparent";

        this._profileChart.addAxis("y", {
          title: "Elevation (m)",
          titleGap: 8,
          titleFontColor: fontColor,
          vertical: true,
          minorTicks: false,
          majorTick: { color: "#fff", width: 0.5 },
          stroke: lineStroke,
          font: "normal normal normal 9pt Avenir Next W00",
          fontColor: fontColor
        });
        this._profileChart.addAxis("other y", {
          leftBottom: false,
          vertical: true,
          includeZero: true,
          minorTicks: false,
          stroke: { color: "#fff", width: 1.0 }
        });

        this._profileChart.addAxis("x", {
          title: "Distance (m)",
          titleGap: 5,
          titleOrientation: "away",
          titleFontColor: fontColor,
          natural: true,
          includeZero: true,
          fixUpper: "none",
          minorTicks: false,
          majorTick: lineStroke,
          stroke: lineStroke,
          font: "normal normal normal 9pt Avenir Next W00",
          fontColor: fontColor
        });

        this._profileChart.addPlot("grid", {
          type: Grid,
          hMajorLines: true,
          hMinorLines: false,
          vMajorLines: false,
          vMinorLines: false,
          majorHLine: { color: "#ddd", width: 0.5 }
        });

        this._profileChart.addPlot("default", { type: Areas, tension: "S", precision: 1 });
        this._profileChart.addPlot("other", { type: Areas, tension: "S", precision: 1, hAxis: "x", vAxis: "other y" });


        const fill_color = new Color("#80823b");
        fill_color.a = 0.5;

        this._profileChart.addSeries("elevations", this._default_infos, {
          stroke: { color: Color.named.yellow, width: 2.5 },
          fill: fill_color
        });

        const mouseIndicator = new MouseIndicator(this._profileChart, "default", {
          series: "elevations",
          mouseOver: true,
          offset: { x: 0, y: -20 },
          markerStroke: { color: "#0079c1", width: 5.0 },
          markerOutline: { color: Color.named.white, width: 1.5 },
          stroke: { color: "#fff" },
          fill: "#0079c1",
          fontColor: Color.named.white,
          font: "normal normal normal 11pt Avenir Next W00",
          labelFunc: (indicator_info) => {
            const elevation_info = (this._profile_infos || this._default_infos).find(info => {
              return (info.x === indicator_info.x);
            });
            this.emit("update-indicator", { coords: elevation_info.coords });
            return `${number.format(indicator_info.y, { places: 1 })} m`;
          }
        });

        // RENDER //
        this._profileChart.render();

        // RESIZE //
        on(window, "resize", () => {
          this._profileChart.resize();
        });
      });

    },

    /**
     *
     */
    _clearChart: function () {
      this._updateChart(this._default_infos);
    },

    /**
     *
     * @param infos
     */
    _updateChart: function (infos) {
      this._profile_infos = infos;
      this._profileChart.updateSeries("elevations", this._profile_infos);
      this._profileChart.render();
    },

    /**
     *
     * @param polygon
     * @returns {*}
     * @private
     */
    _polygonToPolyline: function (polygon) {
      return new Polyline({
        spatialReference: polygon.spatialReference,
        hasM: polygon.hasM, hasZ: polygon.hasZ,
        paths: polygon.rings
      });
    },

    /**
     *
     * @param path
     */
    setPath: function (path) {

      if(path) {

        // POLYGON TO POLYLINE //
        if(path.type === "polygon") {
          path = this._polygonToPolyline(path);
        }

        // DENSIFY POLYLINE//
        const polyline_length = geometryEngine.geodesicLength(path, "meters");
        const polyline = geometryEngine.densify(path, (polyline_length / this.min_point_count), "meters");

        // ADD ELEVATIONS AS Z TO POLYLINE //
        const polyline_z = this.view.groundView.elevationSampler.queryElevation(polyline);
        // ADD DISTANCES AS M TO POLYLINE //
        const polyline_zm = this._setMAsDistanceAlong(polyline_z);

        // GET PROFILE INFOS //
        const profile_infos = this._getProfileInfos(polyline_zm);
        // UPDATE ELEVATION PROFILE CHART //
        this._updateChart(profile_infos.chart_data);

        // PROFILE DETAILS //
        this._updateProfileDetails(profile_infos);

      } else {
        // CLEAR CHART //
        this._clearChart();
        // CLEAR DETAILS //
        this._updateProfileDetails();
      }
    },

    /**
     *
     * @param profile_infos
     * @private
     */
    _updateProfileDetails: function (profile_infos) {

      const num_format = num => number.format(num, { places: 1 });

      if(profile_infos) {

        const infos = [
          // `Distance:${num_format(profile_infos.max_m)}`,
          // `Elevation:`,
          `first: ${num_format(profile_infos.first_z)}`,
          `last: ${num_format(profile_infos.last_z)}`,
          `change: ${num_format(profile_infos.last_z - profile_infos.first_z)}`,
          `min: ${num_format(profile_infos.min_z)}`,
          `max: ${num_format(profile_infos.max_z)}`,
          `range: ${num_format(profile_infos.max_z - profile_infos.min_z)}`,
        ];

        this._detailsNode.innerHTML = infos.join("&nbsp;&nbsp;");
        this._detailsNode.title = infos.join("  ");
      } else {
        this._detailsNode.title = this._detailsNode.innerHTML = "";
      }

    },

    /**
     *
     * @param polyline
     * @returns polyline
     */
    _setMAsDistanceAlong: function (polyline) {
      let distanceAlong = 0.0;
      return new Polyline({
        hasZ: true, hasM: true,
        spatialReference: polyline.spatialReference,
        paths: polyline.paths.map((part, partIdx) => {
          return part.map((coords, coordIdx) => {
            const location = polyline.getPoint(partIdx, coordIdx);
            const prevLocation = polyline.getPoint(partIdx, (coordIdx > 0) ? (coordIdx - 1) : 0);
            distanceAlong += geometryEngine.distance(prevLocation, location, "meters");
            return [coords[0], coords[1], coords[2] || 0.0, distanceAlong];
          });
        })
      });
    },

    /**
     *
     * @param polyline
     * @returns {{x,y,coords}[]}
     * @private
     */
    _getProfileInfos: function (polyline) {
      //console.info(polyline.paths.length, polyline.paths);

      const last_path = (polyline.paths.length - 1);
      return polyline.paths.reduce((infos, path, pathIdx) => {
        const last_coord = (path.length - 1);
        return path.reduce((infos, coords, coordsIndex) => {

          if((pathIdx === 0) && (coordsIndex === 0)) {
            infos.first_z = coords[2];
          }
          if((pathIdx === last_path) && (coordsIndex === last_coord)) {
            infos.last_z = coords[2];
          }

          infos.min_m = Math.min(infos.min_m, coords[3]);
          infos.max_m = Math.max(infos.max_m, coords[3]);
          infos.min_z = Math.min(infos.min_z, coords[2]);
          infos.max_z = Math.max(infos.max_z, coords[2]);

          infos.chart_data.push({
            y: (coords[2] || 0.0),         // Z //
            x: (coords[3] || coordsIndex), // M //
            coords: coords,
            index: coordsIndex
          });

          return infos;
        }, infos);
      }, {
        chart_data: [],
        first_z: -1,
        last_z: -1,
        min_m: Infinity,
        max_m: -Infinity,
        min_z: Infinity,
        max_z: -Infinity
      });

    }

  });

  ElevationProfileChart.version = "0.0.1";

  return ElevationProfileChart;
});