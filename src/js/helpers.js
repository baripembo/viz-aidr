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