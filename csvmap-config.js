'use strict';

var csvmap = {
  config: {
    title: 'Farmworker Service Directory',

    //categories_file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTMOxMk_hNgG6xZjvCfMYBhXZRGTSfEw6MDjuNLU1MsginC8ZtGlQQrUPDHeS8PvoAJv6xJVQQNx4He/pub?gid=1927915399&single=true&output=csv',
    categories_file: 'data/categories.csv',

    //data_file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTMOxMk_hNgG6xZjvCfMYBhXZRGTSfEw6MDjuNLU1MsginC8ZtGlQQrUPDHeS8PvoAJv6xJVQQNx4He/pub?gid=1785004179&single=true&output=csv',
    data_file: 'data/english.csv',

    name_field: 'organization',
    lon_field: 'longitude',
    lat_field: 'latitude',
    multivalue_fields: [ 'category', 'subcategory', 'email', 'website' ],

    // all linked_fields should also be listed in multivalue_fields above
    linked_fields: [ 'email', 'website' ],

    autocomplete_fields: [ 'category', 'subcategory', 'city', 'county', 'organization' ],
    unsearched_fields: [ 'internal-note', 'notes', 'notes-internal', 'amy-notes' ],
    seen: {},
    template_en: `
      <h2>{{organization}}</h2>
      <dl>
        {{#website}}<dt>Website</dt><dd>{{{website}}}</dd>{{/website}}
        <dt>Address</dt>
        <dd>{{address}},
          {{#address2}}{{address2}}, {{/address2}}
          {{#pobox}}{{pobox}}, {{/pobox}}
          <br>
          {{city}}, {{state}} {{zipcode}}
          (<a href="https://www.google.com/maps/dir/?api=1&destination={{address}},+{{city}},+{{state}}+{{zipcode}}" target="_blank">directions</a>)
        </dd>
        {{#county}}<dt>County</dt><dd>{{county}}</dd>{{/county}}
        {{#phone}}<dt>Phone</dt><dd>{{phone}}</dd>{{/phone}}
        {{#fax}}<dt>Fax</dt><dd>{{fax}}</dd>{{/fax}}
        {{#email}}<dt>Contact</dt><dd>{{{email}}}</dd>{{/email}}
        {{#hours}}<dt>Hours</dt><dd>{{hours}}</dd>{{/hours}}
        {{#transportation}}<dt>Transportation</dt><dd>{{transportation}}</dd>{{/transportation}}
        {{#translation}}<dt>Translation</dt><dd>{{translation}}</dd>{{/translation}}
        {{#bilingual}}<dt>Bilingual</dt><dd>{{bilingual}}</dd>{{/bilingual}}
        {{#documents}}<dt>Required documents</dt><dd>{{documents}}</dd>{{/documents}}
        {{#citizenship}}<dt>Citizenship</dt><dd>{{citizenship}}</dd>{{/citizenship}}
        {{#cost}}<dt>Cost</dt><dd>{{cost}}</dd>{{/cost}}
        {{#category}}<dt>Category</dt><dd>{{{category}}}</dd>{{/category}}
        {{#subcategory}}<dt>Subcategory</dt><dd>{{{subcategory}}}</dd>{{/subcategory}}
      </dl>
    `,
    template_es: `
      <h2>{{organization}}</h2>
      <dl>
        {{#website}}<dt>Sitio web</dt><dd>{{{website}}}</dd>{{/website}}
        <dt>Dirección</dt>
        <dd>{{address}},
          {{#address2}}{{address2}}, {{/address2}}
          {{#pobox}}{{pobox}}, {{/pobox}}
          <br>
          {{city}}, {{state}} {{zipcode}}
          (<a href="https://www.google.com/maps/dir/?api=1&destination={{address}},+{{city}},+{{state}}+{{zipcode}}" target="_blank">direcciones</a>)
        </dd>
        {{#county}}<dt>Condado</dt><dd>{{county}}</dd>{{/county}}
        {{#phone}}<dt>Teléfono</dt><dd>{{phone}}</dd>{{/phone}}
        {{#fax}}<dt>Fax</dt><dd>{{fax}}</dd>{{/fax}}
        {{#email}}<dt>Contacto</dt><dd>{{{email}}}</dd>{{/email}}
        {{#hours}}<dt>Horrario</dt><dd>{{hours}}</dd>{{/hours}}
        {{#transportation}}<dt>Transportación</dt><dd>{{transportation}}</dd>{{/transportation}}
        {{#translation}}<dt>Interpretación</dt><dd>{{translation}}</dd>{{/translation}}
        {{#bilingual}}<dt>Bilingüe</dt><dd>{{bilingual}}</dd>{{/bilingual}}
        {{#documents}}<dt>Documentos requeridos</dt><dd>{{documents}}</dd>{{/documents}}
        {{#citizenship}}<dt>Ciudadanía</dt><dd>{{citizenship}}</dd>{{/citizenship}}
        {{#cost}}<dt>Costos</dt><dd>{{cost}}</dd>{{/cost}}
        {{#category}}<dt>Categoría</dt><dd>{{{category}}}</dd>{{/category}}
        {{#subcategory}}<dt>Subcategoría</dt><dd>{{{subcategory}}}</dd>{{/subcategory}}
      </dl>
    `,
    labels: {
      'en': {
        'county': 'County',
        'category': 'Category',
        'subcategory': 'Subcategory',
        'organization': 'Organization',
        'address': 'Address',
        'address2': 'Address2',
        'pobox': 'POBox',
        'city': 'City',
        'state': 'State',
        'zipcode': 'Zipcode',
        'longitude': 'Longitude',
        'latitude': 'Latitude',
        'phone': 'Phone',
        'fax': 'Fax',
        'email': 'Electronic contact',
        'website': 'Website',
        'hours': 'Hours',
        'transportation': 'Transportation',
        'translation': 'Translation',
        'bilingual': 'Bilingual',
        'documents': 'Documents',
        'citizenship': 'Citizenship',
        'cost': 'Cost',
        'notes': 'Notes'
      },
      'es': {
        'county': 'Condado',
        'category': 'Categoría',
        'subcategory': 'Subcategoría',
        'organization': 'Organización',
        'address': 'Dirección',
        'address2': 'Dirección2',
        'pobox': 'Apartado',
        'city': 'Ciudad',
        'state': 'Estado',
        'zipcode': 'Código postal',
        'longitude': 'Longitud',
        'latitude': 'Latitud',
        'phone': 'Teléfono',
        'fax': 'Fax',
        'email': 'Correo electronico',
        'website': 'Sitio web',
        'hours': 'Horrario',
        'transportation': 'Transportación',
        'translation': 'Interpretación',
        'bilingual': 'Bilingüe',
        'documents': 'Documentos',
        'citizenship': 'Ciudadanía',
        'cost': 'Costos',
        'notes': 'Apuntos'
      }
    }
  }
}

csvmap.lang = lang;

if (lang=='es') {
  // espanol
  //csvmap.config.data_file = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTMOxMk_hNgG6xZjvCfMYBhXZRGTSfEw6MDjuNLU1MsginC8ZtGlQQrUPDHeS8PvoAJv6xJVQQNx4He/pub?gid=1985522431&single=true&output=csv';
  csvmap.config.data_file = 'data/spanish.csv';
}

// are we using a mobile or other device with a small screen?
csvmap.mobile = function() {
  return window.matchMedia('(max-width:800px)').matches;
}

