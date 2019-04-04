/*
  Copyright 2017 Esri

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.​
*/

define([
  "calcite",
  "dojo/_base/declare",
  "ApplicationBase/ApplicationBase",
  "dojo/i18n!./nls/resources",
  "ApplicationBase/support/itemUtils",
  "ApplicationBase/support/domHelper",
  "dojo/_base/Color",
  "dojo/colors",
  "dojo/number",
  "dojo/date/locale",
  "dojo/on",
  "dojo/query",
  "dojo/dom",
  "dojo/dom-class",
  "dojo/dom-construct",
  "esri/identity/IdentityManager",
  "esri/core/Evented",
  "esri/core/watchUtils",
  "esri/core/promiseUtils",
  "esri/portal/Portal",
  "esri/layers/Layer",
  "esri/layers/GraphicsLayer",
  "esri/geometry/Extent",
  "esri/geometry/Polyline",
  "esri/geometry/geometryEngine",
  "esri/Graphic",
  "esri/widgets/Home",
  "esri/widgets/Search",
  "esri/widgets/BasemapGallery",
  "esri/widgets/Expand",
  "esri/widgets/Sketch",
  "esri/widgets/Sketch/SketchViewModel",
  "Application/ElevationProfileChart"
], function (calcite, declare, ApplicationBase, i18n, itemUtils, domHelper,
             Color, colors, number, locale, on, query, dom, domClass, domConstruct,
             IdentityManager, Evented, watchUtils, promiseUtils, Portal,
             Layer, GraphicsLayer, Extent, Polyline, geometryEngine,
             Graphic, Home, Search, BasemapGallery, Expand, Sketch, SketchViewModel,
             ElevationProfileChart) {

  return declare([Evented], {

    /**
     *
     */
    constructor: function () {
      this.CSS = {
        loading: "configurable-application--loading"
      };
      this.base = null;

      // CALCITE WEB //
      calcite.init();
    },

    /**
     *
     * @param base
     */
    init: function (base) {
      if(!base) {
        console.error("ApplicationBase is not defined");
        return;
      }
      domHelper.setPageLocale(base.locale);
      domHelper.setPageDirection(base.direction);

      this.base = base;
      const config = base.config;
      const results = base.results;
      const find = config.find;
      const marker = config.marker;

      const allMapAndSceneItems = results.webMapItems.concat(results.webSceneItems);
      const validMapItems = allMapAndSceneItems.map(function (response) {
        return response.value;
      });

      const firstItem = validMapItems[0];
      if(!firstItem) {
        console.error("Could not load an item to display");
        return;
      }
      config.title = (config.title || itemUtils.getItemTitle(firstItem));
      domHelper.setPageTitle(config.title);

      const viewProperties = itemUtils.getConfigViewProperties(config);
      viewProperties.container = "view-container";
      viewProperties.constraints = { snapToZoom: false };

      const portalItem = this.base.results.applicationItem.value;
      const appProxies = (portalItem && portalItem.appProxies) ? portalItem.appProxies : null;

      itemUtils.createMapFromItem({ item: firstItem, appProxies: appProxies }).then((map) => {
        viewProperties.map = map;
        itemUtils.createView(viewProperties).then((view) => {
          itemUtils.findQuery(find, view).then(() => {
            itemUtils.goToMarker(marker, view).then(() => {
              this.viewReady(config, firstItem, view).then(() => {
                domClass.remove(document.body, this.CSS.loading);
              });
            });
          });
        });
      });
    },

    /**
     *
     * @param config
     * @param item
     * @param view
     */
    viewReady: function (config, item, view) {

      // TITLE //
      dom.byId("app-title-node").innerHTML = config.title;

      // LOADING //
      const updating_node = domConstruct.create("div", { className: "view-loading-node loader" });
      domConstruct.create("div", { className: "loader-bars" }, updating_node);
      domConstruct.create("div", { className: "loader-text font-size--3 text-white", innerHTML: "Updating..." }, updating_node);
      view.ui.add(updating_node, "bottom-right");
      watchUtils.init(view, "updating", (updating) => {
        domClass.toggle(updating_node, "is-active", updating);
      });

      // USER SIGN IN //
      return this.initializeUserSignIn(view).always(() => {

        // POPUP DOCKING OPTIONS //
        view.popup.dockEnabled = true;
        view.popup.dockOptions = {
          buttonEnabled: false,
          breakpoint: false,
          position: "top-center"
        };

        // SEARCH //
        const search = new Search({ view: view, searchTerm: this.base.config.search || "" });
        const searchExpand = new Expand({
          view: view,
          content: search,
          expandIconClass: "esri-icon-search",
          expandTooltip: "Search"
        });
        view.ui.add(searchExpand, { position: "top-left", index: 0 });

        // BASEMAPS //
        const basemapGalleryExpand = new Expand({
          view: view,
          content: new BasemapGallery({ view: view }),
          expandIconClass: "esri-icon-basemap",
          expandTooltip: "Basemap"
        });
        view.ui.add(basemapGalleryExpand, { position: "top-left", index: 1 });

        // HOME //
        const home = new Home({ view: view });
        view.ui.add(home, { position: "top-left", index: 2 });

        // SLIDES //
        this.initializeSlides(view);

        // APPLICATION READY //
        this.applicationReady(view);

      });

    },

    /**
     *
     * @returns {*}
     */
    initializeUserSignIn: function (view) {

      const checkSignInStatus = () => {
        return IdentityManager.checkSignInStatus(this.base.portal.url).then(userSignIn);
      };
      IdentityManager.on("credential-create", checkSignInStatus);
      IdentityManager.on("credential-destroy", checkSignInStatus);

      // SIGN IN NODE //
      const signInNode = dom.byId("sign-in-node");
      const userNode = dom.byId("user-node");

      // UPDATE UI //
      const updateSignInUI = () => {
        if(this.base.portal.user) {
          dom.byId("user-firstname-node").innerHTML = this.base.portal.user.fullName.split(" ")[0];
          dom.byId("user-fullname-node").innerHTML = this.base.portal.user.fullName;
          dom.byId("username-node").innerHTML = this.base.portal.user.username;
          dom.byId("user-thumb-node").src = this.base.portal.user.thumbnailUrl;
          domClass.add(signInNode, "hide");
          domClass.remove(userNode, "hide");
        } else {
          domClass.remove(signInNode, "hide");
          domClass.add(userNode, "hide");
        }
        return promiseUtils.resolve();
      };

      // SIGN IN //
      const userSignIn = () => {
        this.base.portal = new Portal({ url: this.base.config.portalUrl, authMode: "immediate" });
        return this.base.portal.load().then(() => {
          this.emit("portal-user-change", {});
          return updateSignInUI();
        }).otherwise(console.warn);
      };

      // SIGN OUT //
      const userSignOut = () => {
        IdentityManager.destroyCredentials();
        this.base.portal = new Portal({});
        this.base.portal.load().then(() => {
          this.base.portal.user = null;
          this.emit("portal-user-change", {});
          return updateSignInUI();
        }).otherwise(console.warn);

      };

      // USER SIGN IN //
      on(signInNode, "click", userSignIn);

      // SIGN OUT NODE //
      const signOutNode = dom.byId("sign-out-node");
      if(signOutNode) {
        on(signOutNode, "click", userSignOut);
      }

      return checkSignInStatus();
    },

    /**
     *
     * @param view
     */
    initializeSlides: function (view) {

      // WEB SCENE  //
      if(view.map.presentation && view.map.presentation.slides && (view.map.presentation.slides.length > 0)) {

        domClass.remove("slides-panel", "hide");

        // SLIDES CONTAINER //
        let placesPanel = dom.byId("slides-container");

        // SLIDES //
        const slides = view.map.presentation.slides;
        slides.forEach(slide => {

          const slideNode = domConstruct.create("div", {
            className: "slide-node esri-interactive",
          }, placesPanel);

          domConstruct.create("div", {
            className: "slide-label",
            innerHTML: slide.title.text
          }, slideNode);

          domConstruct.create("img", {
            className: "slide-thumb",
            src: slide.thumbnail.url
          }, slideNode);

          on(slideNode, "click", () => {

            if(domClass.contains(slideNode, "goTo")) {
              view.animation.stop();

            } else {

              domClass.add(slideNode, "goTo");
              slide.applyTo(view, {
                animate: true,
                speedFactor: 0.5,
                easing: "out-cubic"   // linear, in-cubic, out-cubic, in-out-cubic, in-expo, out-expo, in-out-expo
              }).always(() => {
                domClass.remove(slideNode, "goTo btn-disabled");
              });
            }

          });
        });

        view.on("layerview-create", (evt) => {
          if(evt.layer.visible) {
            slides.forEach(slide => {
              slide.visibleLayers.add({ id: evt.layer.id });
            });
          }
        });


        const slides_panel = dom.byId("slides-panel");
        const slides_container = dom.byId("slides-container-parent");
        const slides_toggle = dom.byId("slides-panel-toggle");
        on(slides_toggle, "click", () => {
          domClass.toggle(slides_panel, "padding-leader-0");
          domClass.toggle(slides_container, "hide");
          domClass.toggle(slides_toggle, "icon-ui-down-arrow icon-ui-up-arrow");
        });


      }

    },

    /**
     * APPLICATION READY
     *
     * @param view
     */
    applicationReady: function (view) {

      // ELEVATION PROFILE CHART //
      const elevationProfileChart = new ElevationProfileChart({
        container: "chart-node",
        view: view
      });

      const indicatorGraphic = new Graphic({
        symbol: {
          type: "point-3d",
          symbolLayers: [
            {
              type: "object",
              width: 50,
              height: 50,
              depth: 50,
              resource: { primitive: "sphere" },
              material: { color: "#0079c1" }
            }
          ]
        }
      });
      const indicatorGraphicsLayer = new GraphicsLayer({ title: "Indicator", graphics: [indicatorGraphic] });
      view.map.add(indicatorGraphicsLayer);

      elevationProfileChart.on("update-indicator", evt => {
        const coords = evt.coords || [0.0, 0.0, -10000.0, 0.0];
        indicatorGraphic.geometry = {
          type: "point",
          spatialReference: view.spatialReference,
          hasZ: true, hasM: true,
          x: coords[0], y: coords[1],
          z: coords[2], m: coords[3]
        };
      });

      // HIGHLIGHT //
      view.highlightOptions = {
        color: "#0079c1",
        haloOpacity: 0.5,
        fillOpacity: 0.1
      };

      // ELEVATION PROFILE LAYER //
      const profile_layer = new GraphicsLayer({
        title: "Elevation Profiles",
        elevationInfo: { mode: "on-the-ground" }
      });
      view.map.add(profile_layer);

      // SKETCH //
      const sketch = new Sketch({
        viewModel: new SketchViewModel({
          view: view,
          layer: profile_layer,
          polylineSymbol: {
            type: "line-3d",
            symbolLayers: [
              {
                type: "line",
                size: 3.5,
                material: { color: Color.named.yellow }
              }
            ]
          },
          polygonSymbol: {
            type: "polygon-3d",
            symbolLayers: [
              {
                type: "fill",
                material: { color: Color.named.transparent },
                outline: {
                  type: "line",
                  size: 3.5,
                  color: Color.named.yellow
                }
              }
            ]
          }
        })
      });
      view.ui.add(sketch, "top-right");

      // CREATE //
      sketch.on(["create"], create_evt => {
        switch (create_evt.state) {
          case "active":
          case "complete":
            elevationProfileChart.setPath(create_evt.graphic.geometry);
        }
      });
      // UPDATE //
      sketch.on(["update"], update_evt => {
        if(update_evt.state !== "cancel") {
          elevationProfileChart.setPath(update_evt.graphics[0].geometry);
        }
      });
      // DELETE //
      sketch.on(["delete"], delete_evt => {
        elevationProfileChart.setPath();
      });

    }

  });
});