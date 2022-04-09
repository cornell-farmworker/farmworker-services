'use strict'

// set language from browser preferences
var lang = navigator.language.slice(0, 2) === 'en' ? 'en' : 'es'
// but override with language in hash, if provided
if (window.location.hash.slice(0, 3) === '#es') {
  lang = 'es'
} else if (window.location.hash.slice(0, 3) === '#en') {
  lang = 'en'
}

let csvmap = {

  // default to english if that is the browser preference, otherwise spanish
  lang: lang,

  // are we using a mobile or other device with a small screen?
  mobile: function () { return window.matchMedia('(max-width:800px)').matches },

  config: {
    title: 'Farmworker Service Directory',

    // categories_file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTMOxMk_hNgG6xZjvCfMYBhXZRGTSfEw6MDjuNLU1MsginC8ZtGlQQrUPDHeS8PvoAJv6xJVQQNx4He/pub?gid=1927915399&single=true&output=csv',
    categories_file: 'data/categories.csv',

    // data_file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTMOxMk_hNgG6xZjvCfMYBhXZRGTSfEw6MDjuNLU1MsginC8ZtGlQQrUPDHeS8PvoAJv6xJVQQNx4He/pub?gid=1785004179&single=true&output=csv',
    data_file: 'data/services.csv',

    name_field: 'organization',
    lon_field: 'longitude',
    lat_field: 'latitude',
    multivalue_fields: ['category-en', 'category-es', 'subcategory-en', 'subcategory-es', 'email', 'website-en', 'website-es', 'hours-en', 'hours-es'],

    // all linked_fields should also be listed in multivalue_fields above
    linked_fields: ['email', 'website-en', 'website-es'],

    autocomplete_fields: ['category-en', 'category-es', 'subcategory-en', 'subcategory-es', 'city', 'county', 'organization'],
    searched_fields: ['county', 'category-en', 'category-es', 'subcategory-en', 'subcategory-es', 'organization', 'city', 'zipcode'],
    // bilingual_fields: [ 'website', 'hours', 'transportation', 'translation', 'bilingual', 'documents', 'citizenship', 'cost' ],

    template_en: `
      <h2>{{organization}}</h2>
      <dl>
        {{#website-en}}<dt>Website</dt><dd>{{{website-en}}}</dd>{{/website-en}}
        {{#address}}
        <dt>Address</dt>
        <dd>{{address}},
          {{#address2}}{{address2}}, {{/address2}}
          {{#pobox}}{{pobox}}, {{/pobox}}
          <br>
          {{city}}, {{state}} {{zipcode}}
          <br>
          <a href="https://www.google.com/maps/dir/?api=1&destination={{address}},+{{city}},+{{state}}+{{zipcode}}" target="_blank">Directions via Google<img src='image/icons/map.svg'></a>
        </dd>
        {{/address}}
        {{#county}}<dt>County</dt><dd>{{county}}</dd>{{/county}}
        {{#phone}}<dt>Phone</dt><dd>{{phone}}</dd>{{/phone}}
        {{#fax}}<dt>Fax</dt><dd>{{fax}}</dd>{{/fax}}
        {{#email}}<dt>Contact</dt><dd>{{{email}}}</dd>{{/email}}
        {{#hours-en}}<dt>Hours</dt><dd>{{{hours-en}}}</dd>{{/hours-en}}
        {{#transportation-en}}<dt>Transportation</dt><dd>{{transportation-en}}</dd>{{/transportation-en}}
        {{#translation-en}}<dt>Translation</dt><dd>{{translation-en}}</dd>{{/translation-en}}
        {{#bilingual-en}}<dt>Bilingual staff</dt><dd>{{bilingual-en}}</dd>{{/bilingual-en}}
        {{#documents-en}}<dt>Required documents</dt><dd>{{documents-en}}</dd>{{/documents-en}}
        {{#citizenship-en}}<dt>Citizenship</dt><dd>{{citizenship-en}}</dd>{{/citizenship-en}}
        {{#cost-en}}<dt>Cost</dt><dd>{{cost-en}}</dd>{{/cost-en}}
        {{#service-types}}<dt>Types of services</dt><dd>{{{service-types}}}</dd>{{/service-types}}
      </dl>
    `,
    template_es: `
      <h2>{{organization}}</h2>
      <dl>
        {{#website-es}}<dt>Sitio web</dt><dd>{{{website-es}}}</dd>{{/website-es}}
        {{#address}}
        <dt>Dirección</dt>
        <dd>{{address}},
          {{#address2}}{{address2}}, {{/address2}}
          {{#pobox}}{{pobox}}, {{/pobox}}
          <br>
          {{city}}, {{state}} {{zipcode}}
          <br>
          <a href="https://www.google.com/maps/dir/?api=1&destination={{address}},+{{city}},+{{state}}+{{zipcode}}" target="_blank">Direcciones de Google<img src='image/icons/map.svg'></a>
        </dd>
        {{/address}}
        {{#county}}<dt>Condado</dt><dd>{{county}}</dd>{{/county}}
        {{#phone}}<dt>Teléfono</dt><dd>{{phone}}</dd>{{/phone}}
        {{#fax}}<dt>Fax</dt><dd>{{fax}}</dd>{{/fax}}
        {{#email}}<dt>Contacto</dt><dd>{{{email}}}</dd>{{/email}}
        {{#hours-es}}<dt>Horario</dt><dd>{{{hours-es}}}</dd>{{/hours-es}}
        {{#transportation-es}}<dt>Transportación</dt><dd>{{transportation-es}}</dd>{{/transportation-es}}
        {{#translation-es}}<dt>Interpretación</dt><dd>{{translation-es}}</dd>{{/translation-es}}
        {{#bilingual-es}}<dt>Empleados bilingües</dt><dd>{{bilingual-es}}</dd>{{/bilingual-es}}
        {{#documents-es}}<dt>Documentos requeridos</dt><dd>{{documents-es}}</dd>{{/documents-es}}
        {{#citizenship-es}}<dt>Ciudadanía EEUU</dt><dd>{{citizenship-es}}</dd>{{/citizenship-es}}
        {{#cost-es}}<dt>Costos</dt><dd>{{cost-es}}</dd>{{/cost-es}}
        {{#service-types}}<dt>Tipos de servicios</dt><dd>{{{service-types}}}</dd>{{/service-types}}
      </dl>
    `
  },

  i18n: {
    'home-button': {
      'en': 'home',
      'es': 'inicio'
    },
    'no-results': {
      'en': 'No results for your search',
      'es': 'Ningún resultados para su busqueda'
    },
    'results-button': {
      'en': 'return to search results',
      'es': 'volver a los resultados de la búsqueda'
    },
    'switch-button': {
      'en': 'español',
      'es': 'English'
    },
    'splash': {
      'en': `
        <div>The information in this directory was obtained in April of 2020, and updated in March 2022, but changes occur frequently.  Please contact an organization to verify that you have the most recent information before traveling to their location.<button id='splash-button'>Click to continue...</button></div>
      `,
      'es': `
        <div>La información de este directorio fue obtenida en abril del 2020, y actualizado en marzo 2022, pero hay cambios frecuentes.  Por favor contacte directamente a cada organización para obtener/verificar que la información sea la más actualizada.<button id='splash-button'>Haz click para continuar...</button></div>
      `
    },
    'search-text': {
      'en': 'Search for services in New York State:',
      'es': 'Buscar servicios para trabajadores agrícolas en el estado de Nueva York:'
    },
    'search-placeholder': {
      'en': 'city, county, organization, or category',
      'es': 'ciudad, condado, organización, o categoría'
    },
    'search-button': {
      'en': 'search',
      'es': 'buscar'
    },
    'produced': {
      'en': 'Produced by:',
      'es': 'Producido por:'
    },
    'nearest': {
      'en': 'The services nearest to your location are listed first.',
      'es': 'Los servicios más cercanos se enumeran primero.'
    },
    'view-map': {
      'en': 'View on map',
      'es': 'Ver en el mapa'
    },
    'wake': {
      'en': 'click to wake the map',
      'es': 'haga clic para activar el mapa'
    },
    'miles': {
      'en': 'miles away',
      'es': 'millas'
    }
  }
}
