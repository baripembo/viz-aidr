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
  var diff = date.getDate() - date.getDay() + (date.getDay() === 0 ? -7 : 0);
  return new Date(date.setDate(diff)); 
}

function closestSunday(d) {
  var prevSun = d.getDate() - d.getDay();
  var nextSun = prevSun + 7;
  var closestSun = (Math.abs(d.getDate() - prevSun) < Math.abs(d.getDate() - nextSun)) ? prevSun : nextSun;
  d.setDate(closestSun);
  return d;
}
$( document ).ready(function() {
  let isMobile = $(window).width()<600? true : false;
  let aidrPath = 'https://proxy.hxlstandard.org/data.objects.json?strip-headers=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F10gm6NsagysRfcUV1i9y7r6vCXzQd9xBf5H-5z5CFrzM%2Fedit%23gid%3D975970481';
  let acledPath = 'data/2019-acled-education.csv'//https://proxy.hxlstandard.org/data/acbeef.csv
  let geomPath = 'data/worldmap.json';
  
  let aidrData, acledData, geomData, coordData = '';

  var formatDate = d3.timeFormat("%Y-%m-%d");
  var parseDate = d3.timeParse("%m/%d/%y");
  var numFormat = d3.format(",");

  var viewportWidth = $('.grid-container').width();
  
  ////////// slider //////////
  var slider, label, handle, x;
  var moving = false;
  var currentValue = 0;
  var targetValue = 0;
  var startDate, endDate;
  var playButton = d3.select("#play-button");

  function createSlider() {
    var margin = {top: 0, right: 84, bottom: 50, left: 84},
      width = viewportWidth - margin.left - margin.right,
      height = 60 - margin.top - margin.bottom;

    targetValue = width;

    var svg = d3.select("#timeSlider")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    x = d3.scaleTime()
      .domain([startDate, endDate])
      .range([0, targetValue])
      .clamp(true);

    slider = svg.append("g")
      .attr("class", "slider")
      .attr("transform", "translate(" + margin.left + "," + height + ")");

    slider.append("line")
      .attr("class", "track")
      .attr("x1", x.range()[0])
      .attr("x2", x.range()[1])
      .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
        .attr("class", "track-inset")
      .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
        .attr("class", "track-overlay")
        .call(d3.drag()
          .on("start.interrupt", function() { slider.interrupt(); })
          .on("end", function() {
            currentValue = Math.round(x.invert(d3.event.x));
            update(closestSunday(new Date(currentValue))); //snap slider to closest sunday
          })
          .on("drag", function() {
            currentValue = Math.round(x.invert(d3.event.x));
            update(currentValue); 
          })
        );

    slider.insert("g", ".track-overlay")
      .attr("class", "ticks")
      .attr("transform", "translate(0," + 18 + ")")
      .selectAll("text")
        .data(x.ticks(20))
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
      if (i%2 !== 0) d3.select(this).remove();
    });
  }


  function createBarChart() {
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

    var margin = {top: 20, right: 60, bottom: 40, left: 60},
        width = viewportWidth - margin.left - margin.right,
        height = 150 - margin.top - margin.bottom;

    var svg = d3.select("#barChart")
      .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // x axis
    var x = d3.scaleBand()
      .range([0, width])
      .domain(tweetData.map(function(d) { return formatDate(new Date(d.key)); }))
      .padding(0.3);
    svg.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x))
      .selectAll("text")
        // .attr("transform", "translate(-10,0)rotate(-90)")
        // .style("text-anchor", "end")
        .style("display", "none");

    //y axis
    var tweetMax = d3.max(tweetData, function(d) { return +d.value; } );
    var y = d3.scaleLinear()
      .domain([0, tweetMax])
      .range([ height, 0]);
    svg.append("g")
      .attr("transform", "translate("+ width +",0)")
      .call(d3.axisRight(y)
      .tickFormat(d3.format(".2s"))
      .ticks(5));

    svg.selectAll("bar")
      .data(d3.stack().keys(keys)(tweetLangData))
      .enter().append("g")
        .attr("fill", function(d) { return z(d.key); })
      .selectAll("rect")
      .data(function(d) { return d; })
      .enter().append("rect")
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
        //console.log(d);
        var xPosition = d3.mouse(this)[0] - 60;
        var yPosition = d3.mouse(this)[1] - 75;
        tooltip.attr("transform", "translate(" + xPosition + "," + yPosition + ")");
        tooltip.select("foreignObject").html(
          "English: "+ en + "<br>Arabic: "+ ar + "<br>French: "+ fr
        );
      });

    //tooltip
    var tooltip = svg.append("g")
      .attr("class", "tooltip")
      .style("display", "none");
        
    tooltip.append("rect")
      .attr("width", 120)
      .attr("height", 70)
      .attr("fill", "white")
      .style("opacity", 0.7);

    tooltip.append("foreignObject")
      .attr("width", 120)
      .attr("height", 70)
      .append("xhtml:body");

    //legend
    var legend = svg.append("g")
      .attr("class", "label")
      .attr("text-anchor", "end")
      .selectAll("g")
      .data(keys)
      .enter().append("g")
        .attr("transform", function(d, i) { return "translate(0," + i * 16 + ")"; });

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

    //average
    var sum = d3.sum(tweetData, function(d) { return d.value; }); 
    var average = Math.round(sum/tweetData.length);
    var median = d3.median(tweetData, function(d) { return d.value; }); 

    var line = d3.line()
      .x(function(d, i) { return x(formatDate(new Date(d.key))); })
      .y(function(d, i) { return y(median); }); 

    svg.append("path")
      .datum(tweetData)
      .attr("class", "median")
      .attr("d", line);

    svg.append("text")
      .attr("transform", "translate(" + (width) + "," + y(median) + ")")
      .attr("x", -10)
      .attr("y", 1)
      .attr("dy", "1em")
      .attr("text-anchor", "end")
      .attr("class", "medianLabel")
      .html("MEDIAN " + numFormat(median));

    //chart title
    svg.append("text")
      .attr("transform", "translate(" + 0 + "," + 0 + ")")
      .attr("x", 0)
      .attr("y", -20)
      .attr("dy", "1em")
      .attr("text-anchor", "start")
      .attr("class", "labelHeader")
      .html("Insecurity Tweets");
  }


  function createBarChart2() {
    var eventData = d3.nest()
      .key(function (d) { return d.event_start_date; })
      .rollup(function(leaves) { return leaves.length;})
      .entries(acledData);

    var margin = {top: 5, right: 60, bottom: 20, left: 60},
      width = viewportWidth - margin.left - margin.right,
      height = 95 - margin.top - margin.bottom;

    var svg = d3.select("#barChart2")
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
        .attr("transform", "translate(0,0)")
        .call(d3.axisTop(x))
        .selectAll("text")
          .style("display", "none");

    //y axis
    var eventMax = d3.max(eventData, function(d) { return +d.value; } );
    var y = d3.scaleLinear()
      .domain([0, eventMax])
      .range([0, height]);
      svg.append("g")
        .attr("transform", "translate("+ width +",0)")
        .call(d3.axisRight(y)
        .ticks(5));

    //bars
    svg.selectAll("bar")
      .data(eventData)
      .enter()
      .append("rect")
        .attr("x", function(d) { return x(formatDate(new Date(d.key))); })
        .attr("y", function(d) { return y(2); })
        .attr("width", x.bandwidth())
        .attr("height", function(d) { return y(d.value); })
        .attr("fill", "#F7941E");

    //chart title
    svg.append("text")
      .attr("transform", "translate(" + 0 + "," + height + ")")
      .attr("x", 0)
      .attr("y", -25)
      .attr("dy", "1em")
      .attr("text-anchor", "start")
      .attr("class", "labelHeader")
      .html("Insecurity Events");
  }
   
  ////////// plot //////////

  // var dataset;

  // var plot = svg.append("g")
  //     .attr("class", "plot")
  //     .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // d3.csv("circles.csv", prepare, function(data) {
  //   dataset = data;
  //   drawPlot(dataset);
    
  //   playButton
  //     .on("click", function() {
  //     var button = d3.select(this);
  //     if (button.text() == "Pause") {
  //       moving = false;
  //       clearInterval(timer);
  //       // timer = 0;
  //       button.text("Play");
  //     } else {
  //       moving = true;
  //       timer = setInterval(step, 100);
  //       button.text("Pause");
  //     }
  //     console.log("Slider moving: " + moving);
  //   })
  // })

  function prepare(d) {
    d.id = d.id;
    d.date = parseDate(d.date);
    return d;
  }
    
  function step() {
    update(x.invert(currentValue));
    currentValue = currentValue + (targetValue/151);
    if (currentValue > targetValue) {
      moving = false;
      currentValue = 0;
      clearInterval(timer);
      // timer = 0;
      playButton.text("Play");
      console.log("Slider moving: " + moving);
    }
  }

  // function drawPlot(data) {
  //   var locations = plot.selectAll(".location")
  //     .data(data);

  //   // if filtered dataset has more circles than already existing, transition new ones in
  //   locations.enter()
  //     .append("circle")
  //     .attr("class", "location")
  //     .attr("cx", function(d) { return x(d.date); })
  //     .attr("cy", height/2)
  //     .style("fill", function(d) { return d3.hsl(d.date/1000000000, 0.8, 0.8)})
  //     .style("stroke", function(d) { return d3.hsl(d.date/1000000000, 0.7, 0.7)})
  //     .style("opacity", 0.5)
  //     .attr("r", 8)
  //       .transition()
  //       .duration(400)
  //       .attr("r", 25)
  //         .transition()
  //         .attr("r", 8);

  //   // if filtered dataset has less circles than already existing, remove excess
  //   locations.exit()
  //     .remove();
  // }

  function update(h) {
    // update position and text of label according to slider scale
    handle.attr("cx", x(h));
    // label
    //   .attr("x", x(h))
    //   .text(formatDate(h));
    // filter data set and redraw plot
    // var newData = dataset.filter(function(d) {
    //   return d.date < h;
    // })
    // drawPlot(newData);
  }

  var mapsvg, tweetCountryData, eventCountryData;
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
        coords.lat = c.lat;
        coords.lon = c.lon;
      }
    });
    return coords;
  }

  function drawMap(){
    var width = viewportWidth,
        height = 450;

    mapsvg = d3.select('#map').append('svg')
      .attr("width", width)
      .attr("height", height)

    var projection = d3.geoMercator()
      .center([0, 30])
      .scale(width / 7)
      .translate([width / 2, height / 2]);

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
        .attr("fill", "#F2F2F2")
        .attr("d", d3.geoPath()
          .projection(projection)
        )
        .style("stroke", "#B7B7B7");

    //create tweet markers
    var tweetMarker = mapsvg.append("g")
      .selectAll("g")
      .data(tweetCountryData)
      .enter()
        .append("g")
        .append("circle")
        .attr('r', function (d) { 
          return (d.value==0) ? rlog(1) : rlog(d.value); 
        })
        .attr("transform", function(d) {
          return "translate(" + projection([d.lon, d.lat]) + ")";
        });

    tweetMarker
      .attr('fill-opacity', 0.5)
      .attr('fill', '#41B3E6')
      .attr("stroke", '#41B3E6');

    //create event markers
    var eventMarker = mapsvg.append("g")
      .selectAll("g")
      .data(acledData)
      .enter()
        .append("g")
        .append('path')
        .attr("d", d3.symbol().type(d3.symbolTriangle).size(75))
        .attr("transform", function(d) {
          return "translate(" + projection([d.lon, d.lat]) + ")";
        });

    eventMarker
      .attr('fill-opacity', 0.5)
      .attr('fill', '#F7941E')
      //.attr("stroke", '#F7941E');
  }


  function getData() {
    Promise.all([
      d3.csv('data/coordinates.csv'),
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
      });
      endDate = d3.max(aidrData.map(d=>d['#date+week_start']));
      startDate = d3.min(aidrData.map(d=>d['#date+week_start']));

      //parse acled data
      acledData = [];
      data[1] = data[1].reverse();
      data[1].forEach(function(d, i){
        var eventDate = new Date(d.event_date);
        if (eventDate >= startDate && eventDate <= endDate){
          var obj = {
            event_start_date: startOfWeek(eventDate),
            event_date: eventDate,
            event_type: d.event_type,
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
      createBarChart();
      createBarChart2();
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