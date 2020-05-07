'use strict';

var csvFile = 'farmworkers-data.csv';
var csvNameField = 'organization';
var autocomplete_fields = [ 'category', 'subcategory', 'organization' ];

var csvOptions = {
  lonfield: 'longitude',
  latfield: 'latitude',
  delimiter: ','
}

document.getElementById('home').onclick = home;
document.getElementById('searchform').onsubmit = submitSearch;
document.onkeyup = function(e) {
  if (e.key=='Escape') {
    clear_info();
  }
}

// fadeAnimation:false is recommended for grayscale tilelayer, otherwise it may flicker
var map = L.map('map', { fadeAnimation:false });
  //.on('click', function(e) { console.log(e.latlng); })
  //.setMaxBounds([[42.4328,-76.4996], [42.4674,-76.4478]]);

// use a openstreetmap basemap
var osm = L.tileLayer.colorFilter('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
  maxZoom: 19,
  minZoom: 4,
  opacity: 1,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="https://carto.com/location-data-services/basemaps/">Carto</a>',
  filter: [
    'brightness:60%',
    'contrast:400%',
    'saturate:150%'
  ]
}).addTo(map);


var customLayer = L.geoJson(null, {
  // display as little circles
  pointToLayer: function(point, latlng) {
    return L.circleMarker(latlng);
  },
  style: function() {
    return {
      radius: 8,
      color: '#eee',
      fillColor: '#b31b1b',
      weight: 1,
      fillOpacity:1
    };
  },
  onEachFeature: function(feature, layer) {
    // calculate fulltext for searching
    var f = ' ';
    for (var p in feature.properties) {
      var v = feature.properties[p];
      // put space between multivalues
      if (v && typeof(v)==="object") {
        v = v.join(' ');
      }
      f += v + ' ';
    }
    feature.properties.fulltext = f;
    layer.bindTooltip(feature.properties[csvNameField], {direction:'right'});
    layer.on('click', function(e){ show_info(e.target); });
  }
});


var points = omnivore.csv(csvFile, csvOptions, customLayer)
  .on('ready', function(err, data) {
    // once we have all the data...
    var layers = this.getLayers();
    console.log('loaded ' + layers.length + ' points from ' + csvFile);
    initAutocomplete(layers);
    search(''); // interpretHash won't display points unless we start by searching for everything
    interpretHash();
  })
  .on('error', function(x) {
    console.log('error parsing '+csvFile);
    console.log(x);
  })
  .addTo(map);



function escapeRegExp(text) {
  // note that we don't escape .
  return text.replace(/[-\/\\^$*+?()|[\]{}]/g, '\\$&');
}


function initAutocomplete(layers) {
  // build a list of all software, and use it to provide
  // autocomplete for the search box
  var autocomplete_terms = [];
  for (var j=0; j<layers.length; j++) {
    for (var fj=0; fj<autocomplete_fields.length; fj++) {
      var field = autocomplete_fields[fj];
      var val = layers[j].feature.properties[field];
      // TODO split by ;
      if (autocomplete_terms.indexOf(val) < 0) {
        autocomplete_terms.push(val);
      }
    }
  }
  // sort autocomplete terms, case-insensitive
  autocomplete_terms.sort(function(a,b){
    var aa = a.toLowerCase();
    var bb = b.toLowerCase();
    if (aa<bb) return -1;
    if (aa>bb) return 1;
    return 0;
  });

  // add the autocomplete to the search box
  var q = document.getElementById('q');
  new Awesomplete(q, {
    list: autocomplete_terms,
    minChars: 1,
    filter: function (text, qterm) {
      var re = new RegExp('\\b' + escapeRegExp(qterm), 'i');
      return re.test(text);
    },
    autoFirst: false
  });
  // execute the search whenever the input changes
  q.addEventListener('awesomplete-selectcomplete', submitSearch);
  //q.oninput = search;
  //q.onkeyup = search; // just in case the browser doesn't support oninput
  q.focus();
  //interpretHash();
  //search();
}


function interpretHash() {
  // automatically search for terms in the URL hash,
  // so that links to specific searches or features can be shared by URL
  var hash = location.hash;
  console.log('interpret hash '+hash);

  // unescape hash
  hash = unescape(hash).replace(/\+/g, ' ');

  var params = hash.split("/");
  var q = params[1];
  var id = params[2];

  if (q === undefined) {
    q = '';
    id = hash.split('/')[2];
  }

  document.title += ': ' + q + ' / ' + id;
  document.getElementById('q').value = q;
  document.getElementById('q').innerHTML = q;
  search(q, id);
}


function show_info(layer) {
  // return info HTML for the layer feature
  // TODO use mustache templates?
  clear_info();
  var p = layer.feature.properties;
  var html = '<h2>' + p[csvNameField] + '</h2>';
  html += '<table>';
  for (var i in Object.keys(p)) {
    var property = Object.keys(p)[i];

    // don't show these fields
    // TODO
    if (['id','name','fulltext'].indexOf(property) > -1) {
      continue;
    }
    var value = p[property];

    // don't list null or blank properties
    if (value === null || value === '') {
      continue;
    }

    /*
    // add icon to category
    if (property=='category') {
      value = '<img src="image/esl.svg" /> ' +
        '<img src="image/career-education.svg" /> ' + value;
    }
    */

    // linkify things that look like links
    if (typeof(value)=='string' && value.startsWith('http')) {
      value = value.replace(/(?!")(http\S+)/g, '<a href="$1">$1</a>');
    }

    // use html list for software values
    if (property=='software' && value.length>0) {
      value = '<ul><li>' + value.join('</li><li>') + '</li></ul>';
    }

    html += '<tr><th>'+property+':</th><td>' + value + '</td></tr>';
  }
  html += '</table>';
  document.getElementById('info').innerHTML = html;
  // TODO
  document.title = 'Farmworker Services: ' + p[csvNameField];

  // highlight this marker
  layer.bringToFront().setStyle({fillColor:'#ff0', color:'#000', radius:12});
}


function clear_info() {
  document.getElementById('info').innerHTML = '';
  // reset all markers
  points.eachLayer(function(el){
    points.resetStyle(el);
  });
}

function encodeHash(h) {
  // replace slashes with . and keep + : =
  if (typeof(h)==='undefined') {
    h = '';
  }
  h = escape(h.replace(/\//g, '.'))
    .replace(/%20/g, '+')
    .replace(/%3A/g, ':')
    .replace(/%3D/g, '=');
  return h;
}

function home() {
  location.hash = '/';
  interpretHash();
}

function submitSearch(e) {
  e.preventDefault();
  e.returnValue = '';
  var q = document.getElementById('q').value.trim();
  location.hash = '/' + encodeHash(q);
  document.title = 'Cornell Software Map: ' + q;
  search(q);
  return false;
}

function search(q, showid) {
  // showid is optional, and will show details for that result

  // special handling for "R"
  if (q==='r' || q==='R') {
    q += ' ';
  }

  // replace slashes with space
  q = q.replace(/\//g, '.');

  // query must match beginning of a word
  var re = new RegExp('\\b' + escapeRegExp(q), 'i');

  // sort layers by name
  var layers = points.getLayers();
  layers.sort(function(a,b){
    var aa = a.feature.properties[csvNameField].toLowerCase();
    var bb = b.feature.properties[csvNameField].toLowerCase();
    if (aa<bb) return -1;
    if (aa>bb) return 1;
    return 0;
  });

  // reset results
  var results = document.getElementById('results');
  results.innerHTML = '';
  clear_info();

  var lastMatch = null;
  var bounds = L.latLngBounds();
  for (var i=0; i<layers.length; i++) {
    var item = layers[i];
    if (item.feature.properties.fulltext.match(re)) {
      lastMatch = item;
      item.addTo(map);

      var ll = item.getLatLng();
      if (ll.lat != 0 || ll.lng != 0) {
        // expand bounds to include current point
        bounds.extend(item.getLatLng());
      }

      var id = item.feature.properties.id;
      var name = item.feature.properties[csvNameField];
      var li = document.createElement('li');
      li.innerHTML = '<a href="#/' + encodeHash(q) + '/' + encodeHash(id) + '">'+name+'</a>';
      var a = li.firstChild;

      // link to marker on map
      a.setAttribute('data', i);
      a.onmouseover = function(e){
        var id = e.target.getAttribute('data');
        layers[id].openTooltip();
      }
      a.onmouseout = function(e){
        var id = e.target.getAttribute('data');
        layers[id].closeTooltip();
      }
      a.onclick = function(e){
        var id = e.target.getAttribute('data');

        var item = layers[id];
        show_info(item);

        var ll = item.getLatLng();
        if (ll.lat != 0 || ll.lng != 0) {
          map.panTo(ll);
        }
      }
      a.onfocus = function(e){
        e.target.click();
      }

      results.appendChild(li);
      if (id === showid) {
        a.focus();
      }
    }
    else {
      item.remove();
    }
  }
  // automatically show details if there is only one match
  if (results.childNodes.length == 1) {
    show_info(lastMatch);
  }

  // pad the bounds by 10% so that points aren't right on the edge of the map
  if (bounds.isValid()) {
    map.fitBounds(bounds.pad(0.03));
  }
}
