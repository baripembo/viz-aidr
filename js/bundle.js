window.$ = window.jQuery = require('jquery');
function hxlProxyToJSON(input){
  var output = [];
  var keys=[]
  input.forEach(function(e,i){
    if(i==0){
      e.forEach(function(e2,i2){
        var parts = e2.split('+');
        var key = parts[0]
        if(parts.length>1){
          var atts = parts.splice(1,parts.length);
          atts.sort();                    
          atts.forEach(function(att){
            key +='+'+att
          });
        }
        keys.push(key);
      });
    } else {
      var row = {};
      e.forEach(function(e2,i2){
        row[keys[i2]] = e2;
      });
      output.push(row);
    }
  });
  return output;
}

function startOfWeek(date) {
  var diff = date.getDate() - date.getDay();
  return new Date(date.setDate(diff)); 
}

function closestSunday(d) {
  var prevSun = d.getDate() - d.getDay();
  var nextSun = prevSun + 7;
  var closestSun = (Math.abs(d.getDate() - prevSun) < Math.abs(d.getDate() - nextSun)) ? prevSun : nextSun;
  d.setDate(closestSun);
  d.setHours(0,0,0,0);
  return d;
}

function skipTicks(ticks) {
  ticks.each(function(_,i){
    if (i%2 !== 0) d3.select(this).remove();
  });
}

function wrap(text, width) {
  text.each(function() {
    var text = d3.select(this),
        words = text.text().split(/\s+/).reverse(),
        word,
        line = [],
        lineNumber = 0,
        lineHeight = 1.1, // ems
        y = text.attr("y"),
        dy = parseFloat(text.attr("dy")),
        tspan = text.text(null).append("tspan").attr("x", 10).attr("y", y).attr("dy", dy + "em");
    while (word = words.pop()) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = text.append("tspan").attr("x", 10).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
      }
    }
  });
}
$( document ).ready(function() {
  let isMobile = $(window).width()<600? true : false;
  let aidrPath = 'https://proxy.hxlstandard.org/data.objects.json?strip-headers=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F10gm6NsagysRfcUV1i9y7r6vCXzQd9xBf5H-5z5CFrzM%2Fedit%23gid%3D975970481';
  let acledPath = 'data/2019-acled-education.csv';//https://proxy.hxlstandard.org/data/acbeef.csv';
  let geomPath = 'data/worldmap.json';
  let coordPath = 'data/coordinates.csv';

  let aidrData, acledData, geomData, coordData = '';

  var formatDate = d3.timeFormat("%Y-%m-%d");
  var parseDate = d3.timeParse("%m/%d/%y");
  var numFormat = d3.format(",");
  var shortNumFormat = d3.format(".2s");
  var viewportWidth = $('.grid-container').width();
  
  ////////// slider //////////
  var slider, label, handle, x;
  var moving = false;
  var currentValue = 0;
  var targetValue = 0;
  var startDate, endDate;
  var playButton = d3.select("#play-button");

  function createSlider() {
    var margin = {top: 0, right: 83, bottom: 50, left: 48},
      width = viewportWidth - margin.left - margin.right,
      height = 60 - margin.top - margin.bottom;

    targetValue = width;

    var svg = d3.select("#timeSlider")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    var temp = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    temp.setDate(temp.getDate() - 7);

    x = d3.scaleTime()
      .domain([temp, endDate])
      .range([0, targetValue])
      .clamp(true);

    slider = svg.append("g")
      .attr("class", "slider")
      .attr("transform", "translate(" + margin.left + "," + height + ")");

    slider.append("line")
      .attr("class", "track")
      .attr("x1", x.range()[0])
      .attr("x2", x.range()[1])
      // .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
      //   .attr("class", "track-inset")
      .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
        .attr("class", "track-overlay")
        .call(d3.drag()
          .on("start.interrupt", function() { slider.interrupt(); })
          .on("end", function() {
            currentValue = Math.round(x.invert(d3.event.x));
            update(closestSunday(new Date(currentValue)), true); //snap slider to closest sunday
          })
          .on("drag", function() {
            currentValue = Math.round(x.invert(d3.event.x));
            update(currentValue); 
          })
        );

    slider.insert("g", ".track-overlay")
      .attr("class", "ticks")
      .attr("transform", "translate(0," + 15 + ")")
      .selectAll("text")
        .data(x.ticks(30))
        .enter()
        .append("text")
        .attr("x", x)
        .attr("y", 10)
        .style("text-anchor", "middle")
        .text(function(d) { return formatDate(d); });

    handle = slider.insert("circle", ".track-overlay")
      .attr("class", "handle")
      .attr("r", 9);

    // label = slider.append("text")  
    //   .attr("class", "label")
    //   .attr("text-anchor", "middle")
    //   .text(formatDate(startDate))
    //   .attr("transform", "translate(0," + (-25) + ")")



    //show every other tick for legibility
    var ticks = d3.selectAll(".ticks text");
    ticks.each(function(_,i){
      if (i==0) d3.select(this).text('All Dates'); //set first tick to show all dates
      if (i%2 !== 0) d3.select(this).remove();
    });
  }

  // gridlines in y axis function
  function make_y_gridlines() {   
    return d3.axisLeft(y)
      .ticks(5)
  }

  function createAidrChart() {
    var tweetData = d3.nest()
      .key(function (d) { return d['#date+week_start']; })
      .rollup(function(leaves) {
        var total = 0;
        leaves.forEach(function(d) {
          total += Number(d['#indicator+tweets']);
        })
        return total;
      }).entries(aidrData);

    //group the data by date and by lang
    var nested = d3.nest()
      .key(function(d) {
        return d['#date+week_start'];
      })
      .key(function(d) {
        return d['#meta+lang'];
      })
      .rollup(function(leaves) {
        var total = 0;
        leaves.forEach(function(d) {
          total += Number(d['#indicator+tweets']);
        })
        return total;
      })
      .entries(aidrData);

    //flatten the nested data
    var tweetLangData = [];
    nested.forEach(function(d) {
      var obj = {"date": d.key};
      tweetLangData.columns = [];
      d.values.forEach(function(v) {
        obj[v.key] = v.value;
        tweetLangData.columns.push(v.key);
      });
      tweetLangData.push(obj);
    });

    var keys = tweetLangData.columns;
    var z = d3.scaleOrdinal().range(["#214189", "#41B3E6", "#9B6E50"]);
    z.domain(keys);

    var margin = {top: 70, right: 60, bottom: 30, left: 60},
        width = viewportWidth - margin.left - margin.right,
        height = 190 - margin.top - margin.bottom;

    var svg = d3.select("#aidrChart")
      .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    //x axis
    var x = d3.scaleBand()
      .range([0, width])
      .domain(tweetData.map(function(d) { return formatDate(new Date(d.key)); }))
      .padding(0.3);
    svg.append("g")
      // .attr("class", "axis")
      // .attr("transform", "translate(0," + height + ")")
      // .call(d3.axisBottom(x))
      // .selectAll("text")
      //   .style("display", "none");

    //y axis
    var tweetMax = d3.max(tweetData, function(d) { return +d.value; } );
    var y = d3.scaleLinear()
      .domain([0, tweetMax])
      .range([ height, 0]);
    svg.append("g")
      //.attr("class", "axis")
      // .attr("transform", "translate("+ width +",0)")
      // .call(d3.axisRight(y)
      //   .tickFormat(shortNumFormat)
      //   .tickSizeOuter(0)
      //   .ticks(5));
      .attr("class", "grid")
      .call(d3.axisRight(y)
        .tickSize(width + 30)
        .tickFormat("")
        .ticks(5));

    svg.append("g")
      .attr("class", "axis")
      .attr("transform", "translate("+ width +",0)")
      .call(d3.axisRight(y)
        .tickFormat(shortNumFormat)
        .ticks(5))
      .selectAll("text")
        .attr("dy", -4);

    //bars
    svg.selectAll("bar")
      .data(d3.stack().keys(keys)(tweetLangData))
      .enter().append("g")
        .attr("fill", function(d) { return z(d.key); })
      .selectAll("rect")
      .data(function(d) { return d; })
      .enter().append("rect")
        .attr("class", "tweet-bar")
        .attr("x", function(d) { return x(formatDate(new Date(d.data.date))); })
        .attr("y", function(d) { return y(d[1]); })
        .attr("height", function(d) { return y(d[0]) - y(d[1]); })
        .attr("width", x.bandwidth())
      .on("mouseover", function() { tooltip.style("display", null); })
      .on("mouseout", function() { tooltip.style("display", "none"); })
      .on("mousemove", function(d) {
        var en = (d.data.en==undefined) ? '0' : numFormat(d.data.en);
        var ar = (d.data.ar==undefined) ? '0' : numFormat(d.data.ar);
        var fr = (d.data.fr==undefined) ? '0' : numFormat(d.data.fr);
        var xPosition = d3.mouse(this)[0] - 50;
        var yPosition = d3.mouse(this)[1] - 85;
        tooltip.attr("transform", "translate(" + xPosition + "," + yPosition + ")");
        tooltip.select("foreignObject").html(
          "English: "+ en + "<br>Arabic: "+ ar + "<br>French: "+ fr
        );
      });

    //legend
    var legend = svg.append("g")
      .attr("class", "label")
      .attr("text-anchor", "end")
      .selectAll("g")
      .data(keys)
      .enter().append("g")
        .attr("transform", function(d, i) { return "translate(-18," + i * 16 + ")"; });

    legend.append("rect")
      .attr("x", 15)
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", z);

    legend.append("text")
      .attr("x", 0)
      .attr("y", 10)
      .attr("dy", "0em")
      .attr("text-anchor", "start")
      .text(function(d) { return d; });

    //median
    var median = d3.median(tweetData, function(d) { return d.value; }); 
    var line = svg.append("line")
      .attr("class", "median")
      .attr("x1", 0)
      .attr("y1", y(median))
      .attr("x2", width-9)
      .attr("y2", y(median));

    svg.append("text")
      .attr("transform", "translate(" + (width) + "," + y(median) + ")")
      .attr("x", -9)
      .attr("y", -14)
      .attr("dy", "1em")
      .attr("text-anchor", "end")
      .attr("class", "median-label")
      .html("MEDIAN " + numFormat(Math.round(median)));

    //chart title
    svg.append("text")
      .attr("transform", "translate(0,0)")
      .attr("x", -20)
      .attr("y", -20)
      .attr("dy", "1em")
      .attr("text-anchor", "start")
      .attr("class", "label-header")
      .html("Insecurity Tweets");

    //tooltip
    var tooltip = svg.append("g")
      .attr("class", "tooltip")
      .style("display", "none");
        
    tooltip.append("rect")
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("width", 100)
      .attr("height", 70)
    
    tooltip.append("path")
      .attr("d", d3.symbol().type(d3.symbolTriangle).size(75))
      .attr("transform", "translate(50,73.5),rotate(-180)");

    tooltip.append("foreignObject")
      .attr("x", 10)
      .attr("y", 10)
      .attr("width", 90)
      .attr("height", 60)
      .append("xhtml:div");

    var gridlines = d3.selectAll(".grid line");
    skipTicks(gridlines);

    var ticks = d3.selectAll("#aidrChart .axis text");
    skipTicks(ticks);
  }


  function createAcledChart() {
    var eventData = d3.nest()
      .key(function (d) { return d.event_start_date; })
      .rollup(function(leaves) { return leaves.length;})
      .entries(acledData);

    var margin = {top: 5, right: 60, bottom: 20, left: 60},
      width = viewportWidth - margin.left - margin.right,
      height = 95 - margin.top - margin.bottom;

    var svg = d3.select("#acledChart")
      .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    //x axis
    var x = d3.scaleBand()
      .range([0, width])
      .domain(eventData.map(function(d) { return formatDate(new Date(d.key)); }))
      .padding(0.3);
      svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0,0)")
        .call(d3.axisTop(x)
          .tickSizeOuter(0))
        .selectAll("text")
          .style("display", "none");

    //y axis
    var eventMax = d3.max(eventData, function(d) { return +d.value; } );
    var y = d3.scaleLinear()
      .domain([0, eventMax])
      .range([0, height]);
      svg.append("g")
        // .attr("class", "axis")
        // .attr("transform", "translate("+ width +",0)")
        // .call(d3.axisRight(y)
        //   .tickSizeOuter(0)
        //   .ticks(5));
        .attr("class", "grid")
        .call(d3.axisRight(y)
          .tickSize(width + 30)
          .tickFormat("")
          .ticks(5));

      svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate("+ width +",0)")
        .call(d3.axisRight(y)
          .tickFormat(shortNumFormat)
          .ticks(5))
        .selectAll("text")
          .attr("dy", 11);

    //bars
    svg.selectAll("bar")
      .data(eventData)
      .enter()
      .append("rect")
        .attr("class", "event-bar")
        .attr("x", function(d) { return x(formatDate(new Date(d.key))); })
        .attr("y", function(d) { return y(2); })
        .attr("width", x.bandwidth())
        .attr("height", function(d) { return y(d.value); })
        .attr("fill", "#F7941E");

    //median
    var median = d3.median(eventData, function(d) { return d.value; }); 
    var line = svg.append("line")
      .attr("class", "median")
      .attr("x1", 0)
      .attr("y1", y(median))
      .attr("x2", width - 9)
      .attr("y2", y(median));

    svg.append("text")
      .attr("transform", "translate(" + (width) + "," + y(median) + ")")
      .attr("x", -9)
      .attr("y", 1)
      .attr("dy", "1em")
      .attr("text-anchor", "end")
      .attr("class", "median-label")
      .html("MEDIAN " + numFormat(Math.round(median)));

    //chart title
    svg.append("text")
      .attr("transform", "translate(" + 0 + "," + height + ")")
      .attr("x", -20)
      .attr("y", -25)
      .attr("dy", "1em")
      .attr("text-anchor", "start")
      .attr("class", "label-header")
      .html("Insecurity Events");

    //skip ticks for legibility
    var ticks = d3.selectAll("#acledChart .axis text");
    skipTicks(ticks);
  }

  var mapsvg, mapTooltip, tweetCountryData, eventCountryData, rlog;
  function initMap(){
    //group tweet data by country
    tweetCountryData = d3.nest()
      .key(function(d) {
        return d['#country+code+v_iso2'];
      })
      .rollup(function(leaves) {
        var total = 0;
        leaves.forEach(function(d) {
          total += Number(d['#indicator+tweets']);
        })
        return total;
      })
      .entries(aidrData);

    //add coord data to grouped data
    for (var i=tweetCountryData.length-1; i>=0; i--){
      if (tweetCountryData[i].key!=''){
        var coords = getCoords(tweetCountryData[i].key);
        tweetCountryData[i].country = coords.country;
        tweetCountryData[i].lat = coords.lat;
        tweetCountryData[i].lon = coords.lon;
      }
      else{
        tweetCountryData.splice(i, 1);
      }
    }

    drawMap();
  }

  function getCoords(code){
    var coords = {};
    coordData.forEach(function(c){
      if (c.country_code==code) {
        coords.country = c.country;
        coords.lat = c.lat;
        coords.lon = c.lon;
      }
    });
    return coords;
  }

  function drawMap(){
    var width = viewportWidth,
      height = 450;

    var projection = d3.geoMercator()
      .center([0, 30])
      .scale(width / 7)
      .translate([width / 2, height / 2]);

    //var mapZoom = d3.zoom()
      //.scaleExtent([1, 2])
      //.on("zoom", function() {
        // var transform = d3.event.transform;

        // mapsvg
        //   //.selectAll('path')
        //     //.attr("d", function(d) { return transform.k * projection([d.lon, d.lat]); });
        //     .attr('transform', transform.toString());
        
        // mapsvg.selectAll('circle')
        //   // .attr('cx', function(d) { return transform.k * projection([d.lon, d.lat])[0]; })
        //   // .attr('cy', function(d) { return transform.k * projection([d.lon, d.lat])[1]; })
        //   .attr('r', function(d) { return (d.value==0) ? rlog(1)/transform.k : rlog(d.value)/transform.k; });     

        // mapsvg
        //   .selectAll('path').style('stroke-width', (mapZoom.scaleExtent()[1]/transform.k) / 2);
      //});

    mapsvg = d3.select('#map').append('svg')
      .attr("width", width)
      .attr("height", height)
      //.call(mapZoom)
      .on("wheel.zoom", null);

    //create log scale for circle markers
    var tweetMax = d3.max(tweetCountryData, function(d) { return +d.value; } );
    rlog = d3.scaleLog()
      .domain([1, tweetMax])
      .range([2, 20]);
        
    //draw map
    var g = mapsvg.append("g")
      .selectAll("path")
      .data(geomData.features)
      .enter()
        .append("path")
        .attr("class", "map-regions")
        .attr("d", d3.geoPath().projection(projection))
        .on("mouseover", function(){ mapTooltip.style("display", null); })
        .on("mouseout", function(){ mapTooltip.style("display", "none"); })
        .on("mousemove", function(d){
          var text = d.properties.NAME;
          var xPos = d3.mouse(this)[0];
          var yPos = d3.mouse(this)[1];
          createMapTooltip(text, xPos, yPos);
        });

    //create tweet markers
    var tweetMarker = mapsvg.append("g")
      .attr("class", "tweetLayer")
      .selectAll("g")
      .data(tweetCountryData)
      .enter()
        .append("g")
        .append("circle")
        .attr("class", "tweet-marker")
        .attr("r", function (d) { return (d.value==0) ? rlog(1) : rlog(d.value); })
        .attr("transform", function(d) { return "translate(" + projection([d.lon, d.lat]) + ")"; })
        .on("mouseover", function(d){ mapTooltip.style("display", null); })
        .on("mouseout", function(){ mapTooltip.style("display", "none"); })
        .on("mousemove", function(d){
          var p = projection([d.lon, d.lat]);
          var text = d.country;
          var xPos = d3.mouse(this)[0] + p[0];
          var yPos = d3.mouse(this)[1] + p[1];
          createMapTooltip(text, xPos, yPos);
        });

    //create event markers
    var eventMarker = mapsvg.append("g")
      .attr("class", "eventLayer")
      .selectAll("g")
      .data(acledData)
      .enter()
        .append("g")
        .append('path')
          .attr('class', 'event-marker')
          .attr("d", d3.symbol().type(d3.symbolTriangle).size(75))
          .attr("transform", function(d) { return "translate(" + projection([d.lon, d.lat]) + ")"; })
          .on("mouseover", function(d){ mapTooltip.style("display", null); })
          .on("mouseout", function(){ mapTooltip.style("display", "none"); })
          .on("mousemove", function(d){
            var p = projection([d.lon, d.lat]);
            var text = d.country;
            var xPos = d3.mouse(this)[0] + p[0];
            var yPos = d3.mouse(this)[1] + p[1]; 
            createMapTooltip(text, xPos, yPos);
          });

    //tooltip
    mapTooltip = mapsvg.append("g")
      .attr("class", "tooltip")
      .style("display", "none");
        
    mapTooltip.append("rect")
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("width", 120)
      .attr("height", 30);
    
    mapTooltip.append('path')
      .attr("d", d3.symbol().type(d3.symbolTriangle).size(75))
      .attr("transform", "translate(50,33.5),rotate(-180)");

    mapTooltip.append("text")
      .attr("x", 10)
      .attr("y", 16)
      .attr("dy", 0)
      .attr("width", 80)
      .attr("height", 20)
      .style("fill", "#000");

    //map layers
    d3.select("#aidrLayer").on("change", function(){
      var o = (d3.select(this).property("checked")) ? 1 : 0;
      d3.select(".tweetLayer").style("opacity", o);
    });
    d3.select("#acledLayer").on("change", function(){
      var o = (d3.select(this).property("checked")) ? 1 : 0;
      d3.select(".eventLayer").style("opacity", o);
    });

    //zoom controls
    // d3.select("#zoom_in").on("click", function() {
    //   console.log("zoom in")
    //   mapZoom.scaleBy(mapsvg.transition().duration(500), 1.1);
    // }); 
    // d3.select("#zoom_out").on("click", function() {
    //   console.log("zoom out")
    //   mapZoom.scaleBy(mapsvg.transition().duration(500), 0.9);
    // });

    createMapLegend();
  }

  function createMapTooltip(content, xPos, yPos){
    var text = mapTooltip.select("text");
    var width = text.node().getBBox().width;
    var height = text.node().getBBox().height;
    text.html(content);
    text.call(wrap, 100);
    mapTooltip.select("path").attr("transform", "translate(" + (width/2+10) + "," + (height+13.5) + "),rotate(-180)");
    mapTooltip
      .attr("transform", "translate(" + (xPos-width/2-10) + "," + (yPos - (height+30)) + ")")
      .select("rect")
        .attr('width', width+20)
        .attr('height', height+10);
  }

  function createMapLegend(){
    var tweetMax = d3.max(tweetCountryData, function(d) { return +d.value; } );
    var legend = d3.select(".legend").append('svg')
      .attr('width', 130)
      .attr('height', 115);

    legend.append('text')
      .attr('class', 'label')
      .attr('transform', 'translate(0,12)')
      .text('Number of Insecurity Tweets');

    legend
      .append('circle')
      .attr('class', 'tweet-marker')
      .attr('r', 2)
      .attr('transform', 'translate(10,38)');

    legend.append('text')
      .attr('class', 'label')
      .attr('transform', 'translate(7,70)')
      .text('1');

    legend.append("circle")
      .attr('class', 'tweet-marker')
      .attr('r', 20)
      .attr("transform", "translate(50,38)");

    legend.append('text')
      .attr('class', 'label tweet-max')
      .attr('transform', 'translate(42,70)')
      .text(shortNumFormat(tweetMax));

    legend.append('text')
      .attr('class', 'label')
      .attr('transform', 'translate(0,95)')
      .text('Insecurity Event');

    legend.append('path')
      .attr('class', 'event-marker')
      .attr("d", d3.symbol().type(d3.symbolTriangle).size(75))
      .attr("transform", "translate(10,110)");
  }




  function update(h, onEnd) {
    // update handle position
    handle.attr("cx", x(h));

    if (onEnd) {
      console.log(h)
      if (h.getTime() < startDate.getTime())
        resetMap();
      else
        updateMap(h);
    }
  }

  function updateMap(filterDate){
    //reformat tweet data filtered by date
    tweetCountryData = d3.nest()
      .key(function(d) {
        return d['#country+code+v_iso2'];
      })
      .rollup(function(leaves) {
        var total = 0;
        leaves.forEach(function(d) {
          if (d['#date+week_start'].getTime() == filterDate.getTime()) {
            total += Number(d['#indicator+tweets']);
          }
        })
        return total;
      })
      .entries(aidrData);

    //show bar selections
    d3.selectAll('.tweet-bar').each(function(d) {
      var bar = d3.select(this);
      var date = new Date(d.data.date);
      var o = (date.getTime() == filterDate.getTime()) ? 1 : 0.4;
      bar.attr('opacity', o);
    });

    d3.selectAll('.event-bar').each(function(d) {
      var bar = d3.select(this);
      var date = new Date(d.key);
      var o = (date.getTime() == filterDate.getTime()) ? 1 : 0.4;
      bar.attr('opacity', o);
    });

    //update log scale for circle markers
    var tweetMax = d3.max(tweetCountryData, function(d) { return +d.value; } );
    rlog = d3.scaleLog()
      .domain([1, tweetMax])
      .range([2, 20]);
    
    //update map legend
    d3.select('.legend').select('.tweet-max').text(shortNumFormat(tweetMax));

    //update map tweet markers
    mapsvg.selectAll('circle').each(function(m) {
      var marker = d3.select(this);
      tweetCountryData.forEach(function(tweet){
        if (m.key == tweet.key) {
          marker.transition().duration(500).attr('r', function (d) { 
            return (tweet.value==0) ? rlog(1) : rlog(tweet.value); 
          })
        }
      });
    });

    //update map event markers
    mapsvg.selectAll('.event-marker').each(function(m, i) {
      var marker = d3.select(this);
      var o = (m.event_start_date.getTime() == filterDate.getTime()) ? 0.5 : 0;
      marker.style('fill-opacity', o);
    });
  }

  function resetMap() {
    //reformat tweet data filtered by date
    tweetCountryData = d3.nest()
      .key(function(d) {
        return d['#country+code+v_iso2'];
      })
      .rollup(function(leaves) {
        var total = 0;
        leaves.forEach(function(d) {
          total += Number(d['#indicator+tweets']);
        })
        return total;
      })
      .entries(aidrData);

    //reset bar selections
    d3.selectAll('.tweet-bar').attr('opacity', 1);
    d3.selectAll('.event-bar').attr('opacity', 1);

    //update log scale for circle markers
    var tweetMax = d3.max(tweetCountryData, function(d) { return +d.value; } );
    rlog = d3.scaleLog()
      .domain([1, tweetMax])
      .range([2, 20]);

    //update map legend
    d3.select('.legend').select('.tweet-max').text(shortNumFormat(tweetMax));

    //reset map tweet markers
    mapsvg.selectAll('circle').each(function(m) {
      var marker = d3.select(this);
      tweetCountryData.forEach(function(tweet){
        if (m.key == tweet.key) {
          marker.transition().duration(500).attr('r', function (d) { 
            return (tweet.value==0) ? rlog(1) : rlog(tweet.value); 
          })
        }
      });
    });

    //reset map event markers
    mapsvg.selectAll('.event-marker').style('fill-opacity', 0.5);
  }

  function getData() {
    Promise.all([
      d3.csv(coordPath),
      d3.csv(acledPath),
      d3.json(aidrPath),
      d3.json(geomPath)
    ]).then(function(data) {
      //parse coord data
      coordData = [];
      data[0].forEach(function(d, i){
        var obj = {
          country: d['Country'],
          country_code: d['Alpha-3 code'],
          lon: d['Longitude (average)'], 
          lat: d['Latitude (average)']
        }
        coordData.push(obj);
      });

      //parse aidr data
      aidrData = data[2];
      aidrData.forEach(function(d) {
        var date = d['#date+week_start'].split('-');
        d['#date+week_start'] = new Date(date[0], date[1]-1, date[2]);
        d['#date+week_start'].setHours(0,0,0,0);
      });
      endDate = d3.max(aidrData.map(d=>d['#date+week_start']));
      startDate = d3.min(aidrData.map(d=>d['#date+week_start']));

      //parse acled data
      acledData = [];
      data[1] = data[1].reverse();
      data[1].forEach(function(d, i){
        var split = d.event_date.split('-');
        var eventDate = new Date(split[0], split[1]-1 , split[2]);
        eventDate.setHours(0,0,0,0);
        var eventStartDate = startOfWeek(new Date(split[0], split[1]-1 , split[2]));
        if (eventDate >= startDate && eventDate <= endDate){
          var obj = {
            event_date: eventDate,
            event_start_date: eventStartDate,
            event_type: d.event_type,
            country: d.country,
            country_code: d.iso3,
            lat: d.latitude,
            lon: d.longitude
          }
          acledData.push(obj);
        }
      });

      //parse geom data
      geomData = topojson.feature(data[3], data[3].objects.geom);

      //remove loader and show vis
      $('.sp').hide();
      $('main, footer').css('opacity', 1);
      createSlider();
      createAidrChart();
      createAcledChart();
      initMap();
    });
  }

  function initTracking() {
    //initialize mixpanel
    let MIXPANEL_TOKEN = '';
    mixpanel.init(MIXPANEL_TOKEN);
    mixpanel.track('page view', {
      'page title': document.title,
      'page type': 'datavis'
    });
  }

  getData();
  //initTracking();
});