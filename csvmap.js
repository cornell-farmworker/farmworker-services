'use strict';

setLanguage(csvmap.lang);

window.addEventListener('hashchange', interpretHash, false);
document.getElementById('splash-button').onclick = closeSplash;
document.getElementById('home-button').onclick = goHome;
document.getElementById('results-button').onclick = returnToResults;
document.getElementById('language-button').onclick = switchLanguage;
document.getElementById('search-form').onsubmit = submitSearch;
document.onkeyup = function(e) {
  if (e.key=='Escape') {
    clearItem();
  }
}

// Try to get user location
navigator.geolocation.getCurrentPosition(gotLocation, gotLocationError, {enableHighAccuracy:false});

function gotLocation(result) {
  console.log('Got Location');
  csvmap.location = result.coords;
}
function gotLocationError(result) {
  console.log('Error getting location:');
  console.log(result);
}

// fadeAnimation:false is recommended for grayscale tilelayer, otherwise it may flicker
var map = L.map('map', {
  fadeAnimation: false,
  fullscreenControl: true,
});

// use a openstreetmap basemap
var osm = L.tileLayer.colorFilter('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
  maxZoom: 19,
  minZoom: 4,
  opacity: 1,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="https://carto.com/location-data-services/basemaps/">Carto</a>',
  filter: [
    'brightness:70%',
    'contrast:300%',
    'saturate:30%'
  ]
}).addTo(map);

csvmap.id2leafid = {};
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
      radius: 5,
      color: '#eee',
      fillColor: '#078b6c',
      weight: 0.7,
      fillOpacity: 1
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
      //if (p == 'county' && v) {
        //v += ' County';
        //feature.properties[p] = v;;
      //}


      // add value to fulltext if it is a searched field
      if (csvmap.config.searched_fields.indexOf(p) > -1) {
        fulltext += v + ' ';
      }

      // split multivalue fields by semicolon
      if (csvmap.config.multivalue_fields.indexOf(p) > -1) {
        v = v.split(/;\s*/);
        var v2 = [];
        var v2es = [];
        for (var vi=0; vi<v.length; vi++) {
          var v2v = v[vi].trim();
          if (v2v.length>0) {
            v2.push(v2v);

            // check for invalid categories/subcategories
            if (p === 'category-en') {
              if (csvmap.categories.indexOf(v2v)===-1) {
                console.log('record ' + feature.properties.id + ' has an invalid '+p+': '+v2v);
              }
              else {
                v2es.push(csvmap.i18n[v2v].es);
              }
            }
            else if (p === 'subcategory-en') {
              if (csvmap.subcategories.indexOf(v2v)===-1) {
                console.log('record ' + feature.properties.id + ' has an invalid '+p+': '+v2v);
              }
              else {
                v2es.push(csvmap.i18n[v2v].es);
              }
              // make sure for each subcategory that we have the corresponding category
              var cat = csvmap.sub2cat[v2v];
              if (feature.properties['category-en'].indexOf(cat) < 0) {
                feature.properties['category-en'].push(cat);

                // add spanish category
                var cat_es = csvmap.i18n[cat].es
                feature.properties['category-es'].push(cat_es);

                // add both en and es category to the fulltext search
                fulltext += cat + ' ' + cat_es + ' ';
              }
            }
          }
        }
        if (v2.length>0) {
          feature.properties[p] = v2;

          // add translated categories/subcategories
          if (p.match(/category/)) {
            feature.properties[p.replace(/-en/, '-es')] = v2es;
            fulltext += v2es.join('; ') + ' ';
          }
        }
      }


    }
    feature.properties._fulltext = fulltext;
    layer.bindTooltip(feature.properties[csvmap.config.name_field], {direction:'right'});
    layer.on('click', function(e){ clickItemMarker(e.target.feature.properties.id); });
  }
});


function clickItemMarker(id) {
  // find the results link that corresponds to the marker and click it,
  // so we get the URL hash, etc.
  var a = document.querySelector('[data-id="'+id+'"]');
  a.click();
}

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
      showResults('', search('')); // interpretHash won't display points unless we start by searching for everything
      clearPage();

      // index the internal leaflet ids to the table ids
      var t = points.getLayers();
      for (var i=0; i<t.length; i++) {
        var id = t[i].feature.properties.id;
        csvmap.id2leafid[id] = i;
      }

      document.getElementById('loading').remove();

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
  var sub2cat = {};
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

      // build sub2cat index (en only)
      if (lang == 'en') {
        sub2cat[sub] = cat;
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

    // add cat/subcat to i18n list
    csvmap.i18n[cat_en] = {
      'en': cat_en,
      'es': cat_es
    }
    csvmap.i18n[subcat_en] = {
      'en': subcat_en,
      'es': subcat_es
    }
  }
  // store data in csvmap
  csvmap.categoryTree = tree;
  csvmap.categories = categories;
  csvmap.subcategories = subcategories;
  csvmap.sub2cat = sub2cat;
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
  // don't interpret hash until splash is hidden
  var s = document.getElementById('splash');
  if (s.style.display !== 'none') {
    return;
  }

  // the location hash determines what to show
  var hash = unescape(location.hash).replace(/\+/g, ' ');

  // split hash into #lang/q/id
  var params = hash.split("/");
  var lang = params[0].slice(1);
  var q = params[1];
  var id = params[2];

  // default to spanish if lang isn't 'en' or 'es'
  if (! lang.match(/en|es/)) {
    location.hash = '#es';
    return false;
  }
  setLanguage(lang);
  clearPage();

  // #es or #en -- show home (browse)
  if (q === undefined || q === '') {
    showHome();
    return false;
  }

  // search for q (and optionally show item specified by id)
  document.title += ': ' + q + (id ? ' / ' + id : '');
  document.getElementById('q').value = q;
  document.getElementById('q').innerHTML = q;
  showResults(q, search(q), id);
}

function clearPage() {
  // hide most page components -- the appropriate divs will be turned back on
  var divs = document.querySelectorAll('#search, #browse, #results, #results-button, #item, #map');
  for (var i=0; i<divs.length; i++) {
    divs[i].style.display = 'none';
  }
}

function closeSplash() {
  var s = document.getElementById('splash');
  if (s) {
    s.style.display = 'none';
    interpretHash();
  }
}


function setLanguage(lang) {
  csvmap.lang = lang;
  // look for all the i18n elements and set to the specified language
  // (the text strings are set in csvmap-config.js)
  var elements = document.querySelectorAll('[data-i18n]');
  for (var i=0; i<elements.length; i++) {
    var e = elements[i];
    var k = e.dataset.i18n;
    // for placeholder, we need to update just the attribute
    if (k.match(/-placeholder$/)) {
      e.placeholder = csvmap.i18n[k][lang];
    }
    // for everything else, we update the element content
    e.innerHTML = csvmap.i18n[k][lang];
  }
  // add splash listener back
  document.getElementById('splash-button').onclick = closeSplash;
}


function switchLanguage(e) {
  var b = e.target;
  b.blur();
  var lang = b.textContent.slice(0,2).toLowerCase();

  // if still on splash screen, just update that section
  var s = document.getElementById('splash');
  if (s) {
    setLanguage(lang);
  }

  if (lang=='en') {
    location.hash = location.hash.replace(/^#es|^$/, 'en');
  }
  else {
    location.hash = location.hash.replace(/^#en|^$/, 'es');
  }
}


function showItem(layer) {
  // show item details for the layer feature
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

  // build the list of categories and subcategories for this item
  var b = document.createElement('div');
  var tree = csvmap.categoryTree.en;
  var ul = document.createElement('ul');
  for (var cat in tree) {

    // make sure the item has either the category or subcategory
    // (sometimes there are errors in the item data where category was not listed for a subcategory)
    var hasCategory = p['category-en'].includes(cat);
    var hasSubcategory = tree[cat].filter(function(n) { return p['subcategory-en'].indexOf(n) !== -1 }).length > 0;
    if (! hasCategory && ! hasSubcategory) {
      continue;
    }

    var li = document.createElement('li');
    var img = '<img src="' + csvmap.icon[cat] + '" /> ';
    var catstr = csvmap.i18n[cat][csvmap.lang];
    li.innerHTML = '<a href="#' + csvmap.lang + '/' + encodeHash(catstr) + '">' + img + catstr + '</a>';
    ul.appendChild(li);
    var ul2 = document.createElement('ul');
    for (var i=0; i<tree[cat].length; i++) {
      var sub = tree[cat][i];
      if (! p['subcategory-en'].includes(sub)) continue;
      var subli = document.createElement('li');
      var substr = csvmap.i18n[sub][csvmap.lang];
      subli.innerHTML = '<a href="#' + csvmap.lang + '/' + encodeHash(substr) + '">' + substr + '</a>';
      ul2.appendChild(subli);
    }
    ul.appendChild(ul2);
  }
  b.append(ul);

  p2['service-types'] = b.innerHTML;

  var html = Mustache.render(csvmap.config['template_' + csvmap.lang], p2);
  document.getElementById('item').innerHTML = html;

  if (csvmap.mobile()) {
    document.getElementById('search').style.display = 'none';
    document.getElementById('results').style.display = 'none';
    document.getElementById('results-button').style.display = 'block';
  }
  window.scrollTo(0,0);

  document.title = csvmap.config.title + ': ' + p[csvmap.config.name_field];

  // highlight this marker
  layer.bringToFront().setStyle({
    fillColor:'#9d9',
    color:'#034536',
    weight:1,
    radius:10
  });
}


function returnToResults(e) {
  document.getElementById('results-button').style.display = 'none';
  location.hash = location.hash.replace(/\/\d+$/, '');
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


function encodeHash(h) {
  // replace slashes with period, parens with space and keep + : =
  if (typeof(h)==='undefined') {
    h = '';
  }
  h = escape(h.replace(/\//g, '.').replace(/[()]+/g, ' '))
    .replace(/%20/g, '+')
    .replace(/%3A/g, ':')
    .replace(/%3D/g, '=');
  return h;
}

function goHome(e) {
  if (e.target) {
    e.target.blur();
  }
  location.hash = csvmap.lang;
}

function showHome() {
  document.getElementById('q').value = '';
  document.getElementById('search').style.display = 'block';
  buildBrowse();
  document.getElementById('browse').style.display = 'block';
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
    li.innerHTML = '<a href="#' + csvmap.lang + '/' + encodeHash(cat) + '">' + img + cat + '</a>';
    ul.appendChild(li);
    var ul2 = document.createElement('ul');
    for (var i=0; i<tree[cat].length; i++) {
      var sub = tree[cat][i];
      var subli = document.createElement('li');
      subli.innerHTML = '<a href="#' + csvmap.lang + '/' + encodeHash(sub) + '">' + sub + '</a>';
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
  location.hash = csvmap.lang + '/' + encodeHash(q);
  document.title = csvmap.config.title + ': ' + q;
  showResults(q, search(q));
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
      var c = layers[i].feature.geometry.coordinates;
      var dist;
      if (c[0] == 0 && c[1] == 0) {
        // phone hotlines have distance 0 -- will sort to top of results
        dist = 0;
      }
      else {
        dist = ruler.distance(c, [csvmap.location.longitude, csvmap.location.latitude]);
      }
      layers[i].feature.properties.tempdist = dist;
    }
    layers.sort(function(a,b){
      var aa = a.feature.properties.tempdist;
      var bb = b.feature.properties.tempdist;
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

function viewMap() {
  document.getElementById('map').scrollIntoView();
  return false;
}

function showResults(q, results, showid) {
  // reset results
  document.getElementById('search').style.display = 'block';
  document.getElementById('results').style.display = 'block';
  document.getElementById('map').style.display = 'block';
  clearMap();
  clearItem();
  window.scrollTo(0,0);

  var resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';

  if (csvmap.location) {
    var nearest = csvmap.i18n['nearest'][csvmap.lang];
    resultsDiv.innerHTML = '<div>'+nearest+'</div>';
    if (csvmap.mobile()) {
      var viewmap = csvmap.i18n['view-map'][csvmap.lang];
      resultsDiv.innerHTML += '<a onclick="viewMap()">'+viewmap+'</a>';
    }
  }

  var resultsList = document.createElement('ul');
  resultsDiv.append(resultsList);

  var lastMatch = null;
  var bounds = L.latLngBounds();

  var layers = window.points.getLayers();

  for (var i=0; i<results.length; i++) {
    var item = results[i];
    lastMatch = item;
    item.addTo(map);
    var leafid = points.getLayerId(item);

    var ll = item.getLatLng();
    if (ll.lat != 0 || ll.lng != 0) {
      // expand bounds to include current point (if not 0,0)
      bounds.extend(item.getLatLng());
    }

    var id = item.feature.properties.id;
    var name = item.feature.properties[csvmap.config.name_field];
    var li = document.createElement('li');
    li.innerHTML = '<a href="#' + csvmap.lang + '/' + encodeHash(q) + '/' + encodeHash(id) + '">'+name+'</a>';

    // show distance to user (unless coordinates are 0,0)
    var c = item.feature.geometry.coordinates;
    if (c[0] != 0 || c[1] != 0) {
      var dist = item.feature.properties.tempdist;
      if (dist) {
        // add 25% to straight-line distance to approximate driving distance
        li.innerHTML += '<br>~' + Math.round(dist*1.25) + ' ' + csvmap.i18n.miles[csvmap.lang];
      }
    }
    else {
      //li.innerHTML += '<br>(phone hotline)';
    }

    var a = li.firstChild;

    // link to marker on map
    a.dataset.id = id;
    a.onmouseover = function(e){
      var id = e.target.dataset.id;
      layers[csvmap.id2leafid[id]].openTooltip();
    }
    a.onmouseout = function(e){
      var id = e.target.dataset.id;
      layers[csvmap.id2leafid[id]].closeTooltip();
    }
    a.onclick = function(e){
      var id = e.target.dataset.id;
      showItem(layers[csvmap.id2leafid[id]]);

      // unselect any existing selected item
      var s = document.getElementsByClassName('selected')[0];
      if (s) {
        s.classList.remove('selected');
      }

      // select this list item
      e.target.classList.add('selected');

      var ll = item.getLatLng();
      // don't pan to 0,0 coordinates
      if (ll.lat != 0 || ll.lng != 0) {
        map.panTo(ll, { animate:false });
      }
    }
    a.onfocus = function(e){
      e.target.click();
    }

    resultsList.appendChild(li);
    if (id === showid) {
      a.focus();
    }
  }
  // on non-mobile, automatically show details if there is only one match
  if (!csvmap.mobile() && resultsList.childNodes.length == 1) {
    showItem(lastMatch);
  }

  // pad the bounds by 10% so that points aren't right on the edge of the map
  if (! showid && bounds.isValid()) {
    map.fitBounds(bounds.pad(0.1));
  }
  // don't zoom results too far (which happens with single points)
  // note we don't set maxZoom on the map, so that users can zoom in more if they want
  if (map.getZoom() > 16) {
    map.setZoom(16);
  }
}
