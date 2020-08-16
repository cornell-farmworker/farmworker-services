'use strict';

window.addEventListener('hashchange', interpretHash, false);
document.getElementById('searchform').onsubmit = submitSearch;
document.getElementById('browseButton').onclick = show_browse;
document.onkeyup = function(e) {
  if (e.key=='Escape') {
    clearItem();
  }
}

// Try to get user location
navigator.geolocation.getCurrentPosition(gotLocation, gotLocationError, {enableHighAccuracy:false});

function gotLocation(result) {
  console.log(result);
  csvmap.location = result.coords;
}
function gotLocationError(result) {
  console.log('error getting location');
  console.log(result);
}

// fadeAnimation:false is recommended for grayscale tilelayer, otherwise it may flicker
var map = L.map('map', {
  fadeAnimation: false,
  fullscreenControl: true,
  sleep: csvmap.mobile(), // activate sleep only when using a small screen
  sleepTime: 500,
  wakeTime: 1000
});


map.on('click', function(e) { console.log(e.latlng); });

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

Papa.parse(csvmap.config.categories_file, {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: gotCategories
});

var customLayer = L.geoJson(null, {
  // display as little circles
  pointToLayer: function(point, latlng) {
    return L.circleMarker(latlng);
  },
  style: function() {
    return {
      radius: 6,
      color: '#eee',
      fillColor: '#078b6c',
      weight: 1,
      fillOpacity:1
    };
  },
  onEachFeature: function(feature, layer) {
    // calculate fulltext for searching
    var fulltext = ' ';
    for (var p in feature.properties) {
      var v = feature.properties[p];

      // make sure url fields start with http
      if (csvmap.config.linked_fields.indexOf(p) > -1) {
        if (v.length>0 && ! v.match(/@/) && ! v.match(/^(https?|ftp):\/\//)) {
          v = 'http://' + v;
          feature.properties[p] = v;
        }
      }

      // add "County" to county names
      if (p == 'county' && v) {
        v += ' County';
        feature.properties[p] = v;;
      }

      // add value to fulltext unless it is an unsearched field
      if (csvmap.config.unsearched_fields.indexOf(p) == -1) {
        fulltext += v + ' ';
      }

      // split multivalue fields by semicolon
      if (csvmap.config.multivalue_fields.indexOf(p) > -1) {
        v = v.split(/;\s*/);
        var v2 = [];
        for (var vi=0; vi<v.length; vi++) {
          var v2v = v[vi].trim();
          if (v2v.length>0) {
            v2.push(v2v);

            // check for invalid categories/subcategories (en or es)
            if (p=='category') {
              if (csvmap.categories.indexOf(v2v)===-1) {
                console.log('record ' + feature.properties.id + ' has an invalid category: '+v2v);
              }
            }
            else if (p=='subcategory') {
              if (csvmap.subcategories.indexOf(v2v)===-1) {
                console.log('record ' + feature.properties.id + ' has an invalid subcategory: '+v2v);
              }
            }
          }
        }
        if (v2.length>0) {
          feature.properties[p] = v2;
        }
      }


    }
    feature.properties._fulltext = fulltext;
    layer.bindTooltip(feature.properties[csvmap.config.name_field], {direction:'right'});
    layer.on('click', function(e){ show_item(e.target); });
  }
});

var csvOptions = {
  lonfield: csvmap.config.lon_field,
  latfield: csvmap.config.lat_field,
  delimiter: ','
}

function loadPoints() {
  window.points = omnivore.csv(csvmap.config.data_file, csvOptions, customLayer)
    .on('ready', function(err, data) {
      // once we have all the data...
      var layers = this.getLayers();
      console.log('loaded ' + layers.length + ' points from ' + csvmap.config.data_file);
      initAutocomplete(layers);
      show_results('', search('')); // interpretHash won't display points unless we start by searching for everything
      buildBrowse();
      interpretHash();
    })
    .on('error', function(x) {
      console.log('error parsing '+csvmap.config.data_file);
      console.log(x);
    })
    .addTo(map);
}


function gotCategories(results) {
  var data = results.data;
  var langs = [ 'en', 'es' ];
  var tree = {};
  var categories = [];
  var subcategories = [];
  csvmap.icon = {}; // to hold icon filenames for each category/subcategory
  for (var i=0; i<langs.length; i++) {
    tree[langs[i]] = {};
  }
  for (var i=0; i<data.length; i++) {
    var row = data[i];

    // build category tree for each language
    for (var li=0; li<langs.length; li++) {
      var lang = langs[li];
      var cat = row['category-' + lang];
      if (categories.indexOf(cat)===-1) {
        categories.push(cat);
        tree[lang][cat] = [];
      }
      var sub = row['subcategory-' + lang];
      if (sub && subcategories.indexOf(sub)===-1) {
        subcategories.push(sub)
        tree[lang][cat].push(sub);
      }
    }

    // build category icon index
    var cat_en = row['category-en'];
    var cat_es = row['category-es'];
    var icon = 'image/icons/' + cat_en.replace(/\W+/g, '-').toLowerCase() + '.svg';
    csvmap.icon[cat_en] = icon;
    csvmap.icon[cat_es] = icon;

    var subcat_en = row['subcategory-en'];
    var subcat_es = row['subcategory-es'];
    var icon = 'image/icons/' + subcat_en.replace(/\W+/g, '-').toLowerCase() + '.svg';
    csvmap.icon[subcat_en] = icon;
    csvmap.icon[subcat_es] = icon;
  }
  csvmap.categoryTree = tree;
  csvmap.categories = categories;
  csvmap.subcategories = subcategories;
  loadPoints();
}

function escapeRegExp(text) {
  // note that we don't escape .
  return text.replace(/[-\/\\^$*+?()|[\]{}]/g, '\\$&');
}


function initAutocomplete(layers) {
  // build a list of all software, and use it to provide
  // autocomplete for the search box
  var autocomplete_terms = [];
  for (var j=0; j<layers.length; j++) {
    for (var fj=0; fj<csvmap.config.autocomplete_fields.length; fj++) {
      var field = csvmap.config.autocomplete_fields[fj];
      var val = layers[j].feature.properties[field];
      if (Array.isArray(val)) {
        for (var ai=0; ai<val.length; ai++) {
          var vi = val[ai];
          if (autocomplete_terms.indexOf(vi) < 0) {
            autocomplete_terms.push(vi);
          }
        }
      }
      else {
        if (autocomplete_terms.indexOf(val) < 0) {
          autocomplete_terms.push(val);
        }
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
  q.focus();
}


function interpretHash() {
  // automatically search for terms in the URL hash,
  // so that links to specific searches or features can be shared by URL
  // TODO only do this upon initial pageLoad?
  var hash = location.hash;
  console.log('interpret hash '+hash);

  // unescape hash
  hash = unescape(hash).replace(/\+/g, ' ');

  var params = hash.split("/");
  var q = params[1];
  var id = params[2];

  if (q === undefined || q === '') {
    q = '';
    id = hash.split('/')[2];
    if (id === undefined) {
      show_home();
      return false;
    }
  }

  document.title += ': ' + q + ' / ' + id;
  document.getElementById('q').value = q;
  document.getElementById('q').innerHTML = q;
  show_results(q, search(q), id);
}


function show_item(layer) {
  // show item details for the layer feature
  console.log('showing item...');
  console.log(layer);
  clearItem();
  document.getElementById('item').style.display = 'block';
  document.getElementById('map').style.display = 'block';
  if (map.isFullscreen()) {
    map.toggleFullscreen();
  }

  var p = layer.feature.properties;
  var p2 = {};

  // prepare selected properties before insertion into Mustache template
  for (var i in Object.keys(p)) {
    var property = Object.keys(p)[i];

    // copy of value(s)
    var value = p[property];
    if (typeof(value) === 'object') {
      value = value.slice();
    }

    // add icon to category, and make into a link
    if (property=='category' || property=='subcategory') {
      for (var vi=0; vi<value.length; vi++) {
        var v = value[vi];
        value[vi] = '<a href="#/'+v+'"><img src="' + csvmap.icon[v] + '" /> ' + v + '</a>';
      }
    }

    // linkify linked fields
    if ((csvmap.config.linked_fields.indexOf(property) > -1) && value.length>0) {
      for (var vi=0; vi<value.length; vi++) {
        var v = value[vi];
        if (v.indexOf('@') > -1) {
          v = v.replace(/(\S+@\S+)/g, '<a href="mailto:$1" target="_blank">$1</a>');
        }
        else {
          // watch out! there might be multiple urls or non-url text
          v = v.replace(/(?!")((http|ftp)\S+)/g, '<a href="$1" target="_blank">$1</a>');
        }
        value[vi] = v;
      }
    }

    // use html lists for multivalues
    if (typeof(value)=='object' && value.length>0) {
      value = '<ul><li>' + value.join('</li><li>') + '</li></ul>';
    }

    p2[property] = value;

  }

  var html = Mustache.render(csvmap.config['template_' + csvmap.lang], p2);
  document.getElementById('item').innerHTML = html;

  if (csvmap.mobile()) {
    var s = document.getElementById('search')
    document.getElementById('search').style.display = 'none';
    document.getElementById('results').style.display = 'none';
    var rs = document.getElementById('restoreSearch');
    if (rs) {
      rs.remove();
    }
    var d = document.createElement('div');
    d.id = 'restoreSearch';
    d.innerHTML = '<ul><li>Return to search results</li></ul>';
    document.getElementById('title').after(d);
    document.getElementById('restoreSearch').addEventListener('click', restoreSearch);
  }
  window.scrollTo(0,0);

  document.title = csvmap.config.title + ': ' + p[csvmap.config.name_field];

  // highlight this marker
  layer.bringToFront().setStyle({
    fillColor:'#ffff00',
    color:'#000',
    weight:1,
    radius:10
  });
}

function goToSearch() {
  console.log('goToSearch');
  document.getElementById('search').style.display = 'block';
  document.getElementById('browse').style.display = 'block';
  document.getElementById('home').style.display = 'none';
}


function restoreSearch() {
  document.getElementById('search').style.display = 'block';
  document.getElementById('results').style.display = 'block';
  clearItem();
  document.getElementById('restoreSearch').remove();
}


function icon(category) {
  // return an image element for the given category or subcategory
  var icon = category.replace(/\W+/g, '-').toLowerCase() + '.svg';
  var img = '<img src="image/icons/'+ icon + '" /> ';
  return img;
}

function clearItem() {
  document.getElementById('item').innerHTML = '';
  // reset all markers
  window.points.eachLayer(function(el){
    window.points.resetStyle(el);
  });
}

function clearResults() {
  document.getElementById('results').innerHTML = '';
  var rs = document.getElementById('restoreSearch');
  if (rs) {
    rs.remove();
  }
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

function show_home() {
  document.getElementById('home').style.display = 'block';
  document.getElementById('search').style.display = 'none';
  document.getElementById('browse').style.display = 'none';
  document.getElementById('results').style.display = 'none';
  document.getElementById('map').style.display = 'none';
}

function show_browse() {
  document.getElementById('home').style.display = 'none';
  document.getElementById('search').style.display = 'block';
  document.getElementById('browse').style.display = 'block';
  document.getElementById('results').style.display = 'none';
  document.getElementById('item').style.display = 'none';
  document.getElementById('map').style.display = 'none';
}

function buildBrowse() {
  // build the list of categories and subcategories
  var tree = csvmap.categoryTree[csvmap.lang];
  var b = document.getElementById('browse');
  b.innerHTML = '';
  var ul = document.createElement('ul');
  for (var cat in tree) {
    var li = document.createElement('li');
    var img = '<img src="' + csvmap.icon[cat] + '" /> ';
    li.innerHTML = '<a href="#/' + encodeHash(cat) + '">' + img + cat + '</a>';
    ul.appendChild(li);
    var ul2 = document.createElement('ul');
    for (var i=0; i<tree[cat].length; i++) {
      var sub = tree[cat][i];
      var subli = document.createElement('li');
      subli.innerHTML = '<a href="#/' + encodeHash(sub) + '">' + sub + '</a>';
      ul2.appendChild(subli);
    }
    ul.appendChild(ul2);
  }
  b.append(ul);
}

function submitSearch(e) {
  e.preventDefault();
  e.returnValue = '';
  var q = document.getElementById('q').value.trim();
  location.hash = '/' + encodeHash(q);
  document.title = csvmap.config.title + ': ' + q;
  show_results(q, search(q));
  return false;
}

function search(q) {
  // search for the given query string q and return sorted array of results

  // start by sorting all layers
  var layers = window.points.getLayers();

  if (csvmap.location) {
    // sort layers by distance to user location
    var ruler = new CheapRuler(42.8, 'miles');
    for (var i=0; i<layers.length; i++) {
      var dist = ruler.distance(layers[i].feature.geometry.coordinates, [csvmap.location.longitude, csvmap.location.latitude]);
      layers[i].feature.properties.csvmapdist = dist;
    }
    layers.sort(function(a,b){
      var aa = a.feature.properties.csvmapdist;
      var bb = b.feature.properties.csvmapdist;
      if (aa<bb) return -1;
      if (aa>bb) return 1;
      return 0;
    });
  }
  else {
    // sort alphabetically if we don't know user location
    layers.sort(function(a,b){
      var aa = a.feature.properties[csvmap.config.name_field].toLowerCase();
      var bb = b.feature.properties[csvmap.config.name_field].toLowerCase();
      if (aa<bb) return -1;
      if (aa>bb) return 1;
      return 0;
    });
  }

  // replace slashes with space
  q = q.replace(/\//g, '.');

  // create regexp for each term in the query
  var qterms = q.split(' ');
  var regexps = [];
  for (var i=0; i<qterms.length; i++) {
    // query must match beginning of a word
    var re = new RegExp('\\b' + escapeRegExp(qterms[i]), 'i');
    regexps.push(re);
  }

  var results = [];
  for (var i=0; i<layers.length; i++) {
    var item = layers[i];
    var tests = regexps.map(x => item.feature.properties._fulltext.match(x));

    // if all query terms match, add to results
    if (tests.every(x => x)) {
      results.push(item);
    }
  }
  return results;
}

function clearMap() {
  var layers = window.points.getLayers();
  for (var i=0; i<layers.length; i++) {
    layers[i].remove();
  }
}

function show_results(q, results, showid) {
  // reset results
  document.getElementById('home').style.display = 'none';
  document.getElementById('search').style.display = 'block';
  document.getElementById('browse').style.display = 'none';
  document.getElementById('results').style.display = 'block';
  document.getElementById('item').style.display = 'none';
  document.getElementById('map').style.display = 'block';
  clearMap();
  clearResults();
  clearItem();
  window.scrollTo(0,0);

  var resultsList = document.createElement('ul');
  document.getElementById('results').append(resultsList);

  var lastMatch = null;
  var bounds = L.latLngBounds();

  for (var i=0; i<results.length; i++) {
    var item = results[i];
    lastMatch = item;
    item.addTo(map);

    var ll = item.getLatLng();
    if (ll.lat != 0 || ll.lng != 0) {
      // expand bounds to include current point
      bounds.extend(item.getLatLng());
    }

    var id = item.feature.properties.id;
    var name = item.feature.properties[csvmap.config.name_field];
    var li = document.createElement('li');
    li.innerHTML = '<a href="#/' + encodeHash(q) + '/' + encodeHash(id) + '">'+name+'</a>';
    var a = li.firstChild;

    // link to marker on map
    a.setAttribute('data', i);
    a.onmouseover = function(e){
      var id = e.target.getAttribute('data');
      item.openTooltip();
    }
    a.onmouseout = function(e){
      var id = e.target.getAttribute('data');
      item.closeTooltip();
    }
    a.onclick = function(e){
      var id = e.target.getAttribute('data');
      show_item(item);

      var ll = item.getLatLng();
      if (ll.lat != 0 || ll.lng != 0) {
        map.panTo(ll);
      }
    }
    a.onfocus = function(e){
      e.target.click();
    }

    resultsList.appendChild(li);
    if (id === showid) {
      // typing
      a.focus();
    }
  }
  // automatically show details if there is only one match
  if (resultsList.childNodes.length == 1) {
    show_item(lastMatch);
  }

  // pad the bounds by 10% so that points aren't right on the edge of the map
  if (bounds.isValid()) {
    map.fitBounds(bounds.pad(0.03));
  }
}


