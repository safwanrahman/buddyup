'use strict';

(function(exports) {

  var Utils = {
    /**
     * Show or hide the spinner based on it's current visibility status.
     */
    toggle_spinner: function() {
      var spinner = document.getElementById('spinner');

      // the spinner already exist in the DOM so, we just want to toggle
      // it's visibility.
      if (spinner) {
        spinner.classList.toggle('hide');
      } else {
        var span = document.createElement('span');
        span.setAttribute('id', 'spinner');
        span.setAttribute('data-icon', 'sync');

        span.classList.add('spinner');
        document.querySelector('body').appendChild(span);
      }
    },
    /**
     * Display a human-readable relative timestamp.
     * @param {String|Date} time before/after the currentDate.
     * @param {String} useCompactFormat whether to use a compact display format.
     */
    time_since: function(time, use_compact_format) {
      var mozl10n = new navigator.mozL10n.DateTimeFormat();
      return mozl10n.fromNow(time, use_compact_format);
    },
    /**
     * Retrieves the url parameters and returns the key/value pairs as an object.
     */
    get_url_parameters: function() {
      var params = {};
      var urlParams = window.location.search.substring(1);
      var keyValuePairs = urlParams.split('&');

      for (var i = 0, l = keyValuePairs.length; i < l; i++) {
        var keyValue = keyValuePairs[i].split('=');
        params[keyValue[0]] = keyValue[1];
      }
      return params;
    }
  };

  exports.Utils = Utils;

})(window);