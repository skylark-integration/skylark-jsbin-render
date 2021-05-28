/**
 * skylark-jsbin-render - A version of jsbin-render  that ported to running on skylarkjs.
 * @author Hudaokeji, Inc.
 * @version v0.9.0
 * @link https://github.com/skylark-integration/skylark-jsbin-render/
 * @license MIT
 */
(function(factory,globals) {
  var define = globals.define,
      require = globals.require,
      isAmd = (typeof define === 'function' && define.amd),
      isCmd = (!isAmd && typeof exports !== 'undefined');

  if (!isAmd && !define) {
    var map = {};
    function absolute(relative, base) {
        if (relative[0]!==".") {
          return relative;
        }
        var stack = base.split("/"),
            parts = relative.split("/");
        stack.pop(); 
        for (var i=0; i<parts.length; i++) {
            if (parts[i] == ".")
                continue;
            if (parts[i] == "..")
                stack.pop();
            else
                stack.push(parts[i]);
        }
        return stack.join("/");
    }
    define = globals.define = function(id, deps, factory) {
        if (typeof factory == 'function') {
            map[id] = {
                factory: factory,
                deps: deps.map(function(dep){
                  return absolute(dep,id);
                }),
                resolved: false,
                exports: null
            };
            require(id);
        } else {
            map[id] = {
                factory : null,
                resolved : true,
                exports : factory
            };
        }
    };
    require = globals.require = function(id) {
        if (!map.hasOwnProperty(id)) {
            throw new Error('Module ' + id + ' has not been defined');
        }
        var module = map[id];
        if (!module.resolved) {
            var args = [];

            module.deps.forEach(function(dep){
                args.push(require(dep));
            })

            module.exports = module.factory.apply(globals, args) || null;
            module.resolved = true;
        }
        return module.exports;
    };
  }
  
  if (!define) {
     throw new Error("The module utility (ex: requirejs or skylark-utils) is not loaded!");
  }

  factory(define,require);

  if (!isAmd) {
    var skylarkjs = require("skylark-langx-ns");

    if (isCmd) {
      module.exports = skylarkjs;
    } else {
      globals.skylarkjs  = skylarkjs;
    }
  }

})(function(define,require) {

define('skylark-jsbin-render/jsbin',[
	"skylark-langx-ns"
],function(skylark){
	return skylark.attach("intg.jsbin");
});
define('skylark-jsbin-render/renderer',[
  "skylark-langx-async/Deferred",
  "skylark-jquery",
   "./jsbin"
],function (Deferred,$,jsbin) {
    'use strict';
    // move from render/live.js

  /** ============================================================================
   * JS Bin Renderer
   * Messages to and from the runner.
   * ========================================================================== */


    var renderer = {},
        $window = $(window),
        $document = $(document);

    /**
     * Store what runner origin *should* be
     * TODO this should allow anything if x-origin protection should be disabled
     */
    renderer.runner = {};
    renderer.runner.origin = '*';

    /**
     * Setup the renderer
     */
    renderer.setup = function (runnerFrame) {
      renderer.runner.window = runnerFrame.contentWindow;
      renderer.runner.iframe = runnerFrame;
    };

    /**
     * Log error messages, indicating that it's from the renderer.
     */
    renderer.error = function () {
      // it's quite likely that the error that fires on this handler actually comes
      // from another service on the page, like a browser plugin, which we can
      // safely ignore.
      window.console.warn.apply(console, ['Renderer:'].concat([].slice.call(arguments)));
    };

    /**
     * Handle all incoming postMessages to the renderer
     */
    renderer.handleMessage = function (event) {
      if (!event.origin) return;
      var data = event.data;

      if (typeof data !== 'string') {
        // this event isn't for us (i.e. comes from a browser ext)
        return;
      }

      // specific change to handle reveal embedding
      /*
       // Unnecessary? //lwf
      try {
        if (event.data.indexOf('slide:') === 0 || event.data === 'jsbin:refresh') {
          // reset the state of the panel visibility
          jsbin.panels.allEditors(function (p) {
            p.visible = false;
          });
          jsbin.panels.restore();
          return;
        }
      } catch (e) {}
      */

      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch (e) {
        return renderer.error('Error parsing event data:', e.message);
      }

      /*
       // Unnecessary? //lwf
      if (data.type.indexOf('code:') === 0 && jsbin.embed) {
        var panel = data.type.substr(5);
        if (panel === 'js') { panel = 'javascript'; }
        if (' css javascript html '.indexOf(' ' + panel + ' ') === -1) {
          return renderer.error('No matching event handler:', data.type);
        }

        if (!jsbin.state.metadata.pro) {
          return renderer.error('Code injection is only supported on pro created bins');
        }

        jsbin.panels.named[panel].setCode(data.data);
        renderLivePreview();

        return;
      }
      */

      if (typeof renderer[data.type] !== 'function') {
        return false; //renderer.error('No matching handler for event', data);
      }
      try {
        renderer[data.type](data.data);
      } catch (e) {
        renderer.error(e.message);
      }
    };

    /**
     * Send message to the runner window
     */
    renderer.postMessage = function (type, data) {
      if (!renderer.runner.window) {
        return renderer.error('postMessage: No connection to runner window.');
      }
      renderer.runner.window.postMessage(JSON.stringify({
        type: type,
        data: data
      }), renderer.runner.origin);
    };

    /**
     * When the renderer is complete, it means we didn't hit an initial
     * infinite loop
     */
    renderer.complete = function () {
      try {
        store.sessionStorage.removeItem('runnerPending');
      } catch (e) {}
    };

    /**
     * Pass loop protection hit calls up to the error UI
     */
    renderer.loopProtectHit = function (line) {
      var cm = jsbin.panels.named.javascript.editor;

      // grr - more setTimeouts to the rescue. We need this to go in *after*
      // jshint does it's magic, but jshint set on a setTimeout, so we have to
      // schedule after.
      setTimeout(function () {
        var annotations = cm.state.lint.annotations || [];
        if (typeof cm.updateLinting !== 'undefined') {
          // note: this just updated the *source* reference
          annotations = annotations.filter(function (a) {
            return a.source !== 'loopProtectLine:' + line;
          });
          annotations.push({
            from: CodeMirror.Pos(line-1, 0),
            to: CodeMirror.Pos(line-1, 0),
            message: 'Exiting potential infinite loop.\nTo disable loop protection: add "// noprotect" to your code',
            severity: 'warning',
            source: 'loopProtectLine:' + line
          });

          cm.updateLinting(annotations);
        }
      }, cm.state.lint.options.delay || 0);
    };

    /**
     * When the iframe resizes, update the size text
     */
    renderer.resize = (function () {
      var size = renderer.$live.find('.size');

      var hide = throttle(function () {
        size.fadeOut(200);
      }, 2000);

      var embedResizeDone = false;

      return function (data) {
        if (!jsbin.embed) {
          // Display the iframe size in px in the JS Bin UI
          size.show().html(data.width + 'px');
          hide();
        }
        if (jsbin.embed && self !== top && embedResizeDone === false) {
          embedResizeDone = true;
          // Inform the outer page of a size change
          var height = ($body.outerHeight(true) - $(renderer.runner.iframe).height()) + data.offsetHeight;
         window.parent.postMessage({ height: height }, '*');
        }
      };
    }());

    /**
     * When the iframe focuses, simulate that here
     */
    renderer.focus = function () {
      jsbin.panels.focus(jsbin.panels.named.live);
      // also close any open dropdowns
      closedropdown();
    };

    /**
     * Proxy console logging to JS Bin's console
     */
    renderer.console = function (data) {
      var method = data.method,
          args = data.args;

      if (!window._console) {return;}
      if (!window._console[method]) {method = 'log';}

      // skip the entire console rendering if the console is hidden
      ///if (!jsbin.panels.named.console.visible) { return; }

      window._console[method].apply(window._console, args);
    };

    /**
     * Load scripts into rendered iframe
     */
    renderer['console:load:script:success'] = function (url) {
      $document.trigger('console:load:script:success', url);
    };

    renderer['console:load:script:error'] = function (err) {
      $document.trigger('console:load:script:error', err);
    };

    /**
     * Load DOME into rendered iframe
     * TODO abstract these so that they are automatically triggered
     */
    renderer['console:load:dom:success'] = function (url) {
      $document.trigger('console:load:dom:success', url);
    };

    renderer['console:load:dom:error'] = function (err) {
      $document.trigger('console:load:dom:error', err);
    };


   // Runner iframe  
   var  iframe,
        inited;
  /**
   * Render live preview.
   * Create the runner iframe, and if postMe wait until the iframe is loaded to
   * start postMessaging the runner.
   */
  function init($live,runner) {

    if (inited) {
      return inited.promise;
    }

    inited = new Deferred();

    renderer.$live = $live;

    // Basic mode
    // This adds the runner iframe to the page. It's only run once.
    //if (!$live.find('iframe').length) {
      iframe = document.createElement('iframe');
      iframe.setAttribute('class', 'stretch');
      iframe.setAttribute('sandbox', 'allow-modals allow-forms allow-pointer-lock allow-popups allow-same-origin allow-scripts');
      iframe.setAttribute('frameBorder', '0');
      iframe.setAttribute('name', '<proxy>');
      $live.prepend(iframe);
      iframe.src = jsbin.runner;
      try {
        iframe.contentWindow.name = '/' + jsbin.state.code + '/' + jsbin.state.revision;
      } catch (e) {
        // ^- this shouldn't really fail, but if we're honest, it's a fucking mystery as to why it even works.
        // problem is: if this throws (because iframe.contentWindow is undefined), then the execution exits
        // and `var renderLivePreview` is set to undefined. The knock on effect is that the calls to renderLivePreview
        // then fail, and jsbin doesn't boot up. Tears all round, so we catch.
      }
    //}

    iframe.onload = function () {
      if (window.postMessage) {
        // setup postMessage listening to the runner
        $window.on('message', function (event) {
          renderer.handleMessage(event.originalEvent)
        });
        renderer.setup(iframe);
        inited.resolve();
      }
    };

    iframe.onerror = function(err) {
      inited.reject(err);
    };

    /**
     * Events
     */

    $document.on('codeChange.live', function (event, arg) {
      if (arg.origin === 'setValue' || arg.origin === undefined) {
        return;
      }
      store.sessionStorage.removeItem('runnerPending');
    });

    // Listen for console input and post it to the iframe
    $document.on('console:run', function (event, cmd) {
      renderer.postMessage('console:run', cmd);
    });

    $document.on('console:load:script', function (event, url) {
      renderer.postMessage('console:load:script', url);
    });

    $document.on('console:load:dom', function (event, html) {
      renderer.postMessage('console:load:dom', html);
    });

    return inited.promise;
  }


  return jsbin.renderer = renderer;

});

define('skylark-jsbin-render/main',[
	"./renderer"
],function(renderer){
	return renderer;
});
define('skylark-jsbin-render', ['skylark-jsbin-render/main'], function (main) { return main; });


},this);
//# sourceMappingURL=sourcemaps/skylark-jsbin-render.js.map
