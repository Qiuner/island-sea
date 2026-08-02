(function() {
  var chartEl = document.querySelector(".map .chart");
  var breadcrumbEl = document.querySelector(".map .map-breadcrumb");
  var backBtnEl = document.querySelector(".map .map-back");
  var regionLotteryBtnEl = document.querySelector(".map .map-lottery-region");
  var spotLotteryBtnEl = document.querySelector(".map .map-lottery-spot");
  var resultEl = document.querySelector(".map .map-result");
  var scenicCardEl = document.querySelector(".scenic-card");
  var scenicCardCloseEl = document.querySelector(".scenic-card-close");
  var scenicCardImageEl = document.querySelector(".scenic-card-image");
  var scenicCardTitleEl = document.querySelector(".scenic-card-title");
  var scenicCardMetaEl = document.querySelector(".scenic-card-meta");
  var scenicCardDescEl = document.querySelector(".scenic-card-desc");
  var myChart = null;

  var ROOT_ADCODE = "100000";
  var ROOT_NAME = "全国";
  var ROOT_GEOJSON = "./中华人民共和国.geojson";
  var GEOJSON_URL =
    "https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json";
  var PLACEHOLDER_IMAGE =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1550a4"/><stop offset="1" stop-color="#071531"/></linearGradient></defs><rect width="800" height="480" fill="url(#g)"/><text x="50%" y="50%" fill="#dff6ff" font-size="44" text-anchor="middle" dominant-baseline="middle">景区图片加载中</text></svg>'
    );

  var mapCache = {};
  var mapStack = [];
  var currentNode = null;
  var currentFeatureMap = {};
  var currentFeatures = [];
  var allSpots = Array.isArray(window.NATIONAL_5A_SPOTS)
    ? window.NATIONAL_5A_SPOTS.slice()
    : [];
  var visibleScenicSpots = [];
  var activeScenicSpotId = "";
  var randomTimer = null;
  var randomFinalTimer = null;
  var randomRunning = false;
  var randomMode = "";
  var activeRandomName = "";
  var hoveredScenicSpotId = "";

  function ajaxJSON(url) {
    return new Promise(function(resolve, reject) {
      $.getJSON(url)
        .done(resolve)
        .fail(function(xhr, textStatus, errorThrown) {
          reject(new Error(errorThrown || textStatus || "load failed"));
        });
    });
  }

  function mapKey(adcode) {
    return "drill-map-" + adcode;
  }

  function buildGeoUrl(adcode) {
    return GEOJSON_URL.replace("{adcode}", adcode);
  }

  function normalizeProvince(name) {
    return String(name || "")
      .replace(/维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区|省|市/g, "")
      .trim();
  }

  function normalizeText(text) {
    return String(text || "")
      .replace(/[·•—()（）\s]/g, "")
      .trim();
  }

  function averageCenters(centers) {
    var validCenters = centers.filter(function(center) {
      return center && center.length === 2;
    });

    if (!validCenters.length) {
      return [];
    }

    var totals = validCenters.reduce(function(acc, center) {
      acc[0] += Number(center[0]) || 0;
      acc[1] += Number(center[1]) || 0;
      return acc;
    }, [0, 0]);

    return [totals[0] / validCenters.length, totals[1] / validCenters.length];
  }

  function buildTrail(stack, node) {
    var trail = {};
    var list = (stack || []).concat(node ? [node] : []);

    list.forEach(function(item) {
      if (!item || !item.name) {
        return;
      }

      if (item.level === "province") {
        trail.province = item.name;
      } else if (item.level === "city") {
        trail.city = item.name;
      } else if (item.level === "district") {
        trail.district = item.name;
      }
    });

    if (node && node.adcode === ROOT_ADCODE) {
      return trail;
    }

    if (node && node.level === "province") {
      trail.province = node.name;
    } else if (node && node.level === "city") {
      trail.city = node.name;
    } else if (node && node.level === "district") {
      trail.district = node.name;
    }

    return trail;
  }

  function getCenterMap(features) {
    var centerMap = {};

    features.forEach(function(feature) {
      if (!feature || !feature.center || feature.center.length !== 2) {
        return;
      }

      var normalizedName = normalizeText(feature.name);
      centerMap[normalizedName] = feature.center;

      var strippedName = normalizeProvince(feature.name);
      if (strippedName) {
        centerMap[normalizeText(strippedName)] = feature.center;
      }
    });

    return centerMap;
  }

  function getScopeCenter(node, features) {
    if (features.length === 1 && features[0].center && features[0].center.length === 2) {
      return features[0].center.slice();
    }

    var center = averageCenters(
      features.map(function(feature) {
        return feature.center;
      })
    );

    if (center.length === 2) {
      return center;
    }

    if (node.adcode === ROOT_ADCODE) {
      return [104.0, 35.6];
    }

    return [105.0, 34.0];
  }

  function getSpreadScale(node, features) {
    if (node.adcode === ROOT_ADCODE) {
      return [1.4, 1.0];
    }
    if (node.level === "province") {
      return [0.4, 0.3];
    }
    if (node.level === "city") {
      return [0.12, 0.09];
    }
    if (features.length > 20) {
      return [0.08, 0.06];
    }
    return [0.06, 0.045];
  }

  function createOffset(index, seed, scaleX, scaleY) {
    var angle = ((seed % 360) + index * 43) * Math.PI / 180;
    var ring = 0.35 + (index % 5) * 0.16;
    return [
      Math.cos(angle) * scaleX * ring,
      Math.sin(angle) * scaleY * ring
    ];
  }

  function createPosition(baseCenter, index, seed, node, features) {
    var scales = getSpreadScale(node, features);
    var offset = createOffset(index, seed, scales[0], scales[1]);

    return [
      Number(baseCenter[0]) + offset[0],
      Number(baseCenter[1]) + offset[1]
    ];
  }

  function getSpotSeed(spot) {
    return String(spot.id || spot.name || "")
      .split("")
      .reduce(function(total, char) {
        return total + char.charCodeAt(0);
      }, 0);
  }

  function resolveFeatureCenterFromSpot(spot, centerMap) {
    var keys = [
      normalizeText(spot.district),
      normalizeText(spot.city),
      normalizeText((spot.name || "").split("市")[0] + "市"),
      normalizeText((spot.name || "").split("地区")[0] + "地区"),
      normalizeText((spot.name || "").split("州")[0] + "州")
    ].filter(Boolean);

    for (var i = 0; i < keys.length; i += 1) {
      if (centerMap[keys[i]]) {
        return centerMap[keys[i]];
      }
    }

    var matchedKey = Object.keys(centerMap).find(function(key) {
      return key && normalizeText(spot.name).indexOf(key) >= 0;
    });

    return matchedKey ? centerMap[matchedKey] : null;
  }

  function cloneSpotWithPosition(spot, lng, lat, placementSource) {
    return Object.assign({}, spot, {
      lng: lng,
      lat: lat,
      placement_source: placementSource || spot.coordinate_source || "proxy"
    });
  }

  function getScopedSpots(node, trail, spots) {
    if (node.adcode === ROOT_ADCODE) {
      return spots.slice();
    }

    var provinceName = normalizeProvince(trail.province || node.name);
    var currentName = normalizeText(node.name);
    var cityName = normalizeText(trail.city);
    var districtName = normalizeText(trail.district);

    var provinceSpots = spots.filter(function(spot) {
      return normalizeProvince(spot.province) === provinceName;
    });

    if (node.level === "province") {
      return provinceSpots;
    }

    var prefixMatches = provinceSpots.filter(function(spot) {
      return spot.adcode && String(spot.adcode).indexOf(String(node.adcode).slice(0, 4)) === 0;
    });
    if (prefixMatches.length) {
      return prefixMatches;
    }

    var textMatches = provinceSpots.filter(function(spot) {
      var name = normalizeText(spot.name);
      var city = normalizeText(spot.city);
      var district = normalizeText(spot.district);
      return [
        currentName,
        cityName,
        districtName
      ].filter(Boolean).some(function(keyword) {
        return (
          city.indexOf(keyword) >= 0 ||
          district.indexOf(keyword) >= 0 ||
          name.indexOf(keyword) >= 0
        );
      });
    });

    if (textMatches.length) {
      return textMatches;
    }

    return provinceSpots;
  }

  function distributeRootSpots(spots, features) {
    var centerMap = getCenterMap(features);
    var groupIndex = {};

    return spots.map(function(spot) {
      if (spot.coordinate_source === "geo") {
        return cloneSpotWithPosition(spot, spot.lng, spot.lat, "geo");
      }

      var provinceKey = normalizeText(normalizeProvince(spot.province));
      var baseCenter = centerMap[provinceKey] || [spot.lng, spot.lat];
      var index = groupIndex[provinceKey] || 0;
      groupIndex[provinceKey] = index + 1;
      var seed = getSpotSeed(spot);
      var position = createPosition(baseCenter, index, seed, currentNode || getMapNode(ROOT_ADCODE, ROOT_NAME, "country"), features);

      return cloneSpotWithPosition(spot, position[0], position[1], "province-distributed");
    });
  }

  function distributeScopedSpots(node, features, spots) {
    var centerMap = getCenterMap(features);
    var scopeCenter = getScopeCenter(node, features);
    var bucketIndex = {};

    return spots.map(function(spot, index) {
      var matchedCenter = resolveFeatureCenterFromSpot(spot, centerMap) || scopeCenter;
      var bucketKey = matchedCenter.join(",");
      var localIndex = bucketIndex[bucketKey] || 0;
      bucketIndex[bucketKey] = localIndex + 1;
      var seed = getSpotSeed(spot) + index * 13;
      var keepExact =
        spot.coordinate_source === "geo" &&
        spot.adcode &&
        String(spot.adcode).indexOf(String(node.adcode).slice(0, 4)) === 0;

      if (keepExact) {
        return cloneSpotWithPosition(spot, spot.lng, spot.lat, "geo");
      }

      var position = createPosition(matchedCenter, localIndex, seed, node, features);
      return cloneSpotWithPosition(spot, position[0], position[1], "proxy-distributed");
    });
  }

  function resolveVisibleScenicSpots(node, features, allSpotList, stack) {
    var trail = buildTrail(stack, node);
    var scopedSpots = getScopedSpots(node, trail, allSpotList);

    if (node.adcode === ROOT_ADCODE) {
      return distributeRootSpots(scopedSpots, features);
    }

    return distributeScopedSpots(node, features, scopedSpots);
  }

  function getMapNode(adcode, name, level) {
    return {
      adcode: String(adcode),
      name: name,
      level: level || "",
      mapName: mapKey(adcode)
    };
  }

  function loadMapNode(node) {
    if (mapCache[node.adcode]) {
      return mapCache[node.adcode];
    }

    var url = node.adcode === ROOT_ADCODE ? ROOT_GEOJSON : buildGeoUrl(node.adcode);

    mapCache[node.adcode] = ajaxJSON(url).then(function(geojson) {
      echarts.registerMap(node.mapName, geojson);
      return {
        node: node,
        features: (geojson.features || []).map(function(feature) {
          var props = feature.properties || {};
          return {
            name: props.name,
            adcode: String(props.adcode || ""),
            level: props.level || "",
            childrenNum: props.childrenNum || 0,
            center: props.centroid || props.center || []
          };
        })
      };
    });

    return mapCache[node.adcode];
  }

  function loadScenicSpots() {
    return Promise.resolve(allSpots.slice());
  }

  function setResultText(text) {
    if (resultEl) {
      resultEl.textContent = text;
    }
  }

  function setScenicImage(src, altText) {
    scenicCardImageEl.src = src || PLACEHOLDER_IMAGE;
    scenicCardImageEl.alt = altText || "景区图片";
    scenicCardImageEl.onerror = function() {
      scenicCardImageEl.onerror = null;
      scenicCardImageEl.src = buildPosterDataUrl({
        name: scenicCardTitleEl.textContent,
        province: scenicCardMetaEl.textContent
      });
    };
  }

  function buildPosterDataUrl(spot) {
    var title = String((spot && spot.name) || "国家5A级景区")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;");
    var meta = String((spot && spot.province) || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;");

    return (
      "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#123a92"/><stop offset="1" stop-color="#06122c"/></linearGradient><linearGradient id="a" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#58e1ff"/><stop offset="1" stop-color="#ffd84d"/></linearGradient></defs><rect width="800" height="480" fill="url(#g)"/><circle cx="610" cy="114" r="80" fill="rgba(255,255,255,0.08)"/><circle cx="178" cy="340" r="120" fill="rgba(88,225,255,0.12)"/><rect x="56" y="72" width="180" height="10" rx="5" fill="url(#a)"/><text x="56" y="178" fill="#f5fbff" font-size="38" font-weight="700">' +
          title +
          '</text><text x="56" y="236" fill="rgba(223,246,255,0.84)" font-size="24">' +
          meta +
          '</text><text x="56" y="404" fill="rgba(223,246,255,0.72)" font-size="22">本地离线海报兜底</text></svg>'
      )
    );
  }

  function setScenicCardContent(spot) {
    scenicCardTitleEl.textContent = spot.name || "景区";
    scenicCardMetaEl.textContent = [
      spot.level,
      spot.province,
      spot.city,
      spot.district
    ]
      .filter(Boolean)
      .join(" / ");
    scenicCardDescEl.textContent = spot.description || "暂无简介";
    setScenicImage(spot.image_url || buildPosterDataUrl(spot), spot.name + " 图片");
  }

  function showScenicCard() {
    scenicCardEl.classList.remove("scenic-card-hidden");
  }

  function hideScenicCard() {
    scenicCardEl.classList.add("scenic-card-hidden");
    activeScenicSpotId = "";
    hoveredScenicSpotId = "";
  }

  function updateRandomButtons() {
    var disabled = randomRunning || !currentNode;
    if (regionLotteryBtnEl) {
      regionLotteryBtnEl.disabled = disabled;
    }
    if (spotLotteryBtnEl) {
      spotLotteryBtnEl.disabled = disabled;
    }
    if (backBtnEl) {
      backBtnEl.disabled = mapStack.length <= 1 || randomRunning;
    }
  }

  function clearRandomHighlight() {
    if (!activeRandomName) {
      return;
    }

    if (randomMode === "spot") {
      myChart.dispatchAction({
        type: "downplay",
        seriesName: "scenic-spots",
        name: activeRandomName
      });
    } else {
      myChart.dispatchAction({
        type: "downplay",
        seriesIndex: 0,
        name: activeRandomName
      });
    }
    activeRandomName = "";
  }

  function stopRandomSelection(clearMessage) {
    if (randomTimer) {
      clearInterval(randomTimer);
      randomTimer = null;
    }
    if (randomFinalTimer) {
      clearTimeout(randomFinalTimer);
      randomFinalTimer = null;
    }

    randomRunning = false;
    updateRandomButtons();

    if (clearMessage) {
      setResultText("点击按钮开始随机选择");
      clearRandomHighlight();
    }
  }

  function getRandomItem(list) {
    if (!list || !list.length) {
      return null;
    }
    return list[Math.floor(Math.random() * list.length)];
  }

  function highlightRandomItem(item) {
    if (!item) {
      return;
    }

    clearRandomHighlight();
    activeRandomName = item.name;

    if (randomMode === "spot") {
      setScenicCardContent(item);
      showScenicCard();
      myChart.dispatchAction({
        type: "showTip",
        seriesName: "scenic-spots",
        name: item.name
      });
      myChart.dispatchAction({
        type: "downplay",
        seriesName: "scenic-spots"
      });
      myChart.dispatchAction({
        type: "highlight",
        seriesName: "scenic-spots",
        name: item.name
      });
      setResultText("抽取中：" + item.name);
      return;
    }

    myChart.dispatchAction({
      type: "highlight",
      seriesIndex: 0,
      name: item.name
    });
    myChart.dispatchAction({
      type: "showTip",
      seriesIndex: 0,
      name: item.name
    });
    setResultText("抽取中：" + item.name);
  }

  function getRandomRegionList() {
    return currentFeatures.filter(function(feature) {
      return feature.childrenNum > 0;
    });
  }

  function getRandomSpotList() {
    return visibleScenicSpots.slice();
  }

  function startRandomSelection(mode) {
    var list = mode === "spot" ? getRandomSpotList() : getRandomRegionList();

    if (randomRunning || !list.length) {
      setResultText("当前没有可随机选择的目标");
      return;
    }

    randomMode = mode;
    randomRunning = true;
    updateRandomButtons();
    setResultText(mode === "spot" ? "黄色景点抽取中..." : "城市抽取中...");

    randomTimer = setInterval(function() {
      highlightRandomItem(getRandomItem(list));
    }, 300);

    randomFinalTimer = setTimeout(function() {
      var item = getRandomItem(list);
      stopRandomSelection(false);

      if (!item) {
        setResultText("当前没有可随机选择的目标");
        return;
      }

      highlightRandomItem(item);
      setResultText(
        (mode === "spot" ? "你选中了景点：" : "你选中了城市：") + item.name
      );
    }, 5000);
  }

  function openScenicCardById(id) {
    var spot = visibleScenicSpots.find(function(item) {
      return item.id === id;
    });

    if (!spot) {
      return;
    }

    activeScenicSpotId = id;
    hoveredScenicSpotId = "";
    setScenicCardContent(spot);
    showScenicCard();
  }

  function previewScenicCardById(id) {
    var spot = visibleScenicSpots.find(function(item) {
      return item.id === id;
    });

    if (!spot) {
      return;
    }

    hoveredScenicSpotId = id;
    setScenicCardContent(spot);
    showScenicCard();
  }

  function buildScenicSeries(node, spots) {
      return {
      name: "scenic-spots",
      type: "effectScatter",
      coordinateSystem: "geo",
      zlevel: 9,
      animation: true,
      symbolSize: function() {
        if (node.adcode === ROOT_ADCODE) {
          return 15;
        }
        if (node.level === "province") {
          return 18;
        }
        return 16;
      },
      showEffectOn: "render",
      rippleEffect: {
        scale: 3.8,
        brushType: "stroke"
      },
      itemStyle: {
        color: "#ffd84d",
        opacity: 0.95,
        shadowBlur: 28,
        shadowColor: "rgba(255, 216, 77, 0.9)",
        borderColor: "#fff7c2",
        borderWidth: 1
      },
      emphasis: {
        scale: true,
        focus: "self",
        label: {
          show: true,
          formatter: "{b}",
          color: "#ffecec",
          fontSize: 12
        },
        itemStyle: {
          color: "#ff4d4f",
          opacity: 1,
          shadowBlur: 52,
          shadowColor: "rgba(255, 77, 79, 1)",
          borderColor: "#ffffff",
          borderWidth: 3
        }
      },
      tooltip: {
        formatter: function(params) {
          var d = params.data || {};
          return [
            d.name,
            d.province || "",
            d.city || "",
            d.district || ""
          ]
            .filter(Boolean)
            .join("<br/>");
        }
      },
      data: spots.map(function(spot) {
        return {
          id: spot.id,
          name: spot.name,
          value: [spot.lng, spot.lat, 1],
          province: spot.province,
          city: spot.city,
          district: spot.district,
          level: spot.level,
          image_url: spot.image_url,
          description: spot.description,
          itemStyle: {
            opacity: 0.98
          }
        };
      })
    };
  }

  function buildRegionSeries(node, features) {
    return {
      name: node.name,
      type: "map",
      map: node.mapName,
      geoIndex: 0,
      roam: true,
      zoom: node.adcode === ROOT_ADCODE ? 1.05 : 1,
      layoutCenter: ["50%", "56%"],
      layoutSize: node.adcode === ROOT_ADCODE ? "88%" : "82%",
      label: {
        normal: {
          show: true,
          color: "#d7f2ff",
          fontSize: node.adcode === ROOT_ADCODE ? 10 : 11
        },
        emphasis: {
          show: true,
          color: "#ffffff"
        }
      },
      itemStyle: {
        normal: {
          areaColor: "rgba(43, 196, 243, 0.2)",
          borderColor: "rgba(43, 196, 243, 1)",
          borderWidth: 1
        },
        emphasis: {
          areaColor: "rgba(196, 24, 24, 0.55)",
          borderColor: "#ff4d4f",
          borderWidth: 2
        }
      },
      data: features.map(function(feature, index) {
        return {
          name: feature.name,
          value: feature.childrenNum || index + 1,
          adcode: feature.adcode,
          level: feature.level
        };
      })
    };
  }

  function buildRegionLabelSeries(features) {
    return {
      name: "region-labels",
      type: "scatter",
      coordinateSystem: "geo",
      zlevel: 4,
      symbol: "circle",
      symbolSize: 6,
      itemStyle: {
        color: "rgba(255, 255, 255, 0.9)",
        borderColor: "#2dd8ff",
        borderWidth: 1
      },
      label: {
        show: true,
        position: "right",
        distance: 6,
        color: "#e6fbff",
        fontSize: 10,
        formatter: function(params) {
          return params.data.name;
        }
      },
      data: features
        .filter(function(feature) {
          return feature.center && feature.center.length === 2;
        })
        .map(function(feature) {
          return {
            name: feature.name,
            value: feature.center,
            adcode: feature.adcode,
            level: feature.level
          };
        })
    };
  }

  function buildVisualMap(node, features) {
    var maxValue = 0;
    features.forEach(function(feature, index) {
      maxValue = Math.max(maxValue, feature.childrenNum || index + 1);
    });

    return {
      min: 0,
      max: Math.max(maxValue, 1),
      show: node.adcode !== ROOT_ADCODE,
      left: "right",
      bottom: 24,
      text: ["高", "低"],
      textStyle: {
        color: "#d9f4ff"
      },
      calculable: false,
      seriesIndex: 0,
      inRange: {
        color: [
          "rgba(32, 87, 167, 0.42)",
          "rgba(48, 134, 212, 0.6)",
          "rgba(79, 196, 255, 0.86)"
        ]
      }
    };
  }

  function getOption(node, features, spots) {
    return {
      animationDurationUpdate: 500,
      tooltip: {
        trigger: "item",
        formatter: function(params) {
          if (params.seriesName === "region-labels") {
            return [params.data.name, params.data.adcode, params.data.level]
              .filter(Boolean)
              .join("<br/>");
          }

          if (params.seriesName === "scenic-spots") {
            return [
              params.data.name,
              params.data.province,
              params.data.city,
              params.data.district
            ]
              .filter(Boolean)
              .join("<br/>");
          }

          var data = params.data || {};
          return [params.name, data.adcode, data.value].filter(Boolean).join("<br/>");
        }
      },
      geo: {
        map: node.mapName,
        roam: true,
        zoom: node.adcode === ROOT_ADCODE ? 1.05 : 1.22,
        layoutCenter: ["50%", "56%"],
        layoutSize: node.adcode === ROOT_ADCODE ? "88%" : "86%",
        label: {
          normal: { show: false },
          emphasis: { show: true, color: "#fff" }
        },
        itemStyle: {
          normal: {
            areaColor: "rgba(43, 196, 243, 0.18)",
            borderColor: "rgba(43, 196, 243, 0.9)",
            borderWidth: 1
          },
          emphasis: {
            areaColor: "rgba(196, 24, 24, 0.55)",
            borderColor: "#ff4d4f",
            borderWidth: 2
          }
        }
      },
      visualMap: buildVisualMap(node, features),
      series: [
        buildRegionSeries(node, features),
        buildRegionLabelSeries(features),
        buildScenicSeries(node, spots)
      ]
    };
  }

  function canDrill(feature) {
    return Boolean(feature && feature.adcode && feature.childrenNum > 0 && currentNode.level !== "district");
  }

  function updateToolbar() {
    breadcrumbEl.textContent = mapStack.map(function(item) {
      return item.name;
    }).join(" / ");
    updateRandomButtons();
  }

  function renderNode(node, keepStack) {
    stopRandomSelection(true);
    myChart.showLoading("default", { text: "地图加载中..." });

    Promise.all([loadMapNode(node), loadScenicSpots()]).then(function(results) {
      var result = results[0];
      var spots = results[1];
      var nextStack = keepStack
        ? mapStack.slice(0, Math.max(mapStack.length - 1, 0)).concat([result.node])
        : mapStack.concat([result.node]);

      currentNode = result.node;
      currentFeatures = result.features;
      currentFeatureMap = {};
      currentFeatures.forEach(function(feature) {
        currentFeatureMap[feature.name] = feature;
      });
      visibleScenicSpots = resolveVisibleScenicSpots(
        currentNode,
        result.features,
        spots,
        nextStack.slice(0, -1)
      );

      if (!keepStack) {
        mapStack.push(currentNode);
      } else {
        mapStack[mapStack.length - 1] = currentNode;
      }

      updateToolbar();
      setResultText("点击按钮开始随机选择");
      myChart.setOption(getOption(currentNode, result.features, visibleScenicSpots), true);

      if (
        activeScenicSpotId &&
        !visibleScenicSpots.some(function(spot) {
          return spot.id === activeScenicSpotId;
        })
      ) {
        hideScenicCard();
      }
    })
      .catch(function(error) {
        console.error(error);
        alert("地图数据加载失败：" + error.message);
      })
      .finally(function() {
        myChart.hideLoading();
      });
  }

  myChart = echarts.init(chartEl);
  setResultText("点击按钮开始随机选择");
  scenicCardCloseEl.addEventListener("click", hideScenicCard);
  if (regionLotteryBtnEl) {
    regionLotteryBtnEl.addEventListener("click", function() {
      startRandomSelection("region");
    });
  }
  if (spotLotteryBtnEl) {
    spotLotteryBtnEl.addEventListener("click", function() {
      startRandomSelection("spot");
    });
  }
  backBtnEl.addEventListener("click", function() {
    if (mapStack.length <= 1 || randomRunning) {
      return;
    }
    mapStack.pop();
    renderNode(mapStack[mapStack.length - 1], true);
  });

  myChart.on("click", function(params) {
    if (params.seriesName === "scenic-spots") {
      openScenicCardById(params.data.id);
      return;
    }

    if (params.seriesType !== "map" && params.seriesName !== "region-labels") {
      return;
    }

    var feature = currentFeatureMap[params.name];
    if (!canDrill(feature)) {
      return;
    }

    renderNode(getMapNode(feature.adcode, feature.name, feature.level), false);
  });

  myChart.on("mouseover", function(params) {
    if (params.seriesName !== "scenic-spots" || !params.data || !params.data.id) {
      return;
    }

    previewScenicCardById(params.data.id);
  });

  myChart.on("mouseout", function(params) {
    if (params.seriesName !== "scenic-spots" || !params.data || !params.data.id) {
      return;
    }

    if (activeScenicSpotId) {
      if (hoveredScenicSpotId && hoveredScenicSpotId !== activeScenicSpotId) {
        openScenicCardById(activeScenicSpotId);
      }
      return;
    }

    if (hoveredScenicSpotId === params.data.id) {
      hideScenicCard();
    }
  });

  renderNode(getMapNode(ROOT_ADCODE, ROOT_NAME, "country"), false);

  window.addEventListener("resize", function() {
    if (myChart) {
      myChart.resize({ animation: { duration: 0 } });
    }
  });
})();
