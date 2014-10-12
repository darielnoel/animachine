(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"./src/editor/main.js":[function(require,module,exports){
'use strict';

var amgui = require('./amgui');
var EventEmitter = require('events').EventEmitter;
var Transhand = require('./transhand');
var Timeline = require('./timeline');
var Toolbar = require('./toolbar');
var Windooman = require('./windooman');
var Warehouseman = require('./warehouseman');
var Chronicler = require('./chronicler');
var DomPicker = require('./dom-picker');
var dialogFeatureDoesntExits = require('./commonDialogs/dialogFeatureDoesntExits');
var dialogFeedback = require('./commonDialogs/dialogFeedback');
var modules = {
    css: require('./modules/css'),
    js: require('./modules/javascript')
};
var externalStylesheets = [
    // require('./assets/fontello/css/amgui.css'),
    require('./am.css'),
];

var isInited = false, handlerBuff = [];


var am = window.am = module.exports = _.extend(new EventEmitter(), {

    sequenceTypes: {},

    selectedElement: undefined,

    registerSequenceType: function (Sequence, type) {

        this.sequenceTypes[type] = Sequence;
    }
});

am.getHandler = function () {

    if (handlerBuff.length) {

        return handlerBuff.pop();
    }
    else {
        return new Transhand();
    }
};

am.throwHandler = function (handler) {

    handlerBuff.push(handler);
};

am.open = function (save) {

    if (!window.chrome) {
    
        return alertUnsupportedBrowsers();
    }

    am._init();

    if (save) {

        if (typeof(save) === 'string') {

            save = JSON.parse(save);
        }

        am.timeline.useSave(save);
    }
};

am._init = function () {

    if (isInited) return;
    
    am.dialogs = {
        featureDoesntExist: dialogFeatureDoesntExits,
        feedback: dialogFeedback,
    };

    am.workspace = new Windooman();
    am.workspace.loadWorkspaces({
        base: getBaseWorkspace()
    });
    am.workspace.load('base');

    am.storage = new Warehouseman();

    am.domElem = createAmRoot();
    am.deHandlerCont = createAmLayer();
    am.deGuiCont = createAmLayer();
    am.deDialogCont = createAmLayer();


    amgui.deOverlayCont = am.deDialogCont;

    am.deGuiCont.appendChild(am.workspace.domElem);

    am.deRoot = document.body;
    am.history = new Chronicler();
    am.toolbar = new Toolbar();
    am.timeline = new Timeline();
    am.domPicker = new DomPicker();

    am.workspace.fillTab('tools', am.toolbar.domElem);

    am.deHandlerCont.appendChild(am.domPicker.domElem);
    am.domPicker.on('pick', onSelectWithDomPicker);

    am.toolbar.addIcon({
        icon: 'ccw',
        onClick: am.history.undo.bind(am.history)
    });

    am.toolbar.addIcon({
        icon: 'cw',
        onClick: am.history.redo.bind(am.history)
    });


    am.toolbar.addIcon({
        icon: 'megaphone',
        separator: 'rest',
        onClick: function () {
            am.dialogs.feedback.show();
        }
    });



    am.timeline.domElem.style.position = 'fixed';
    am.timeline.domElem.style.width = '100%';
    am.timeline.domElem.style.height = '230px';
    am.timeline.domElem.style.bottom = '0px';
    am.workspace.fillTab('timeline', am.timeline.domElem);

    addToggleGui();

    document.body.addEventListener('click', onClickRoot);

    Object.keys(modules).forEach(function (moduleName) {

        console.log('init', moduleName, 'module...');

        modules[moduleName].init(am);
    });

    createMenu();
    createStatusLabel();
};

function createMenu() {
    
    var iconMenu = am.toolbar.addIcon({
        icon: 'menu',
        separator: 'global',
    });

    amgui.bindDropdown({
        deTarget: iconMenu,
        deMenu: amgui.createDropdown({
            options: [
                {text: 'new', onSelect: onSelectNew},
                {text: 'save', onSelect: onSelectSave},
                {text: 'saveAs', onSelect: onSelectSave},
                {text: 'open', onSelect: onSelectOpen},
            ]
        })
    });

    function onSelectNew() {

        am.timeline.clear();
    }

    function onSelectSave() {

        am.storage.showSaveDialog({

            getSave: function () {
                
                var opt = am.storage.getSaveOptions();

                return am.timeline.getScript(opt);
            }
        });
    }

    function onSelectOpen() {

        am.storage.showOpenDialog({

            onOpen: function (save) {

                console.log(save);

                am.timeline.clear();
                am.timeline.useSave(save);
            }
        });
    }
}

function onClickRoot(e) {

    if (am.isPickableDomElem(e.target)) {
        
        if (e.target !== am.selectedElement) {//hack!
            
            am.domPicker.focusElem(e.target);
        }
    }
    else {
        setSelectedElement(undefined);
    }
}

function onSelectWithDomPicker(de) {

    setSelectedElement(de);
}

function setSelectedElement(de) {

    if (am.selectedElement !== de) {

        am.selectedElement = de;
        am.emit('selectDomElement', am.selectedElement);
    }
}

am.isPickableDomElem = function (deTest) {
    //TODO use .compareDocumentPosition()
    if (!deTest) {
        return false;
    }

    return step(deTest);

    function step(de) {

        if (!de) {
            return false;
        }
        else if (de.nodeType === 9) {
            return false;
        }
        else if (de.hasAttribute('data-am-pick')) {
            return true;
        }
        else if (de.hasAttribute('data-am-nopick')) {
            return false;
        }
        else if (de === document.body) {
            return de !== deTest;
        }
        else if (de) {
            return step(de.parentNode);
        }
    }
};

function createAmRoot() {

    // $('body').css('opacity', .23)
        // .mouseenter(function () {$('body').css('opacity', 1)})
        // .mouseleave(function () {$('body').css('opacity', .23)});
    
    var de = document.createElement('div');
    de.style.position = 'fixed';
    de.style.left = '0px';
    de.style.top = '0px';
    de.style.width = '100%';
    de.style.height = '100%';
    de.style.pointerEvents = 'none';
    de.style.userSelect = 'none';
    de.style.webktUserSelect = 'none';
    de.style.fontFamily = amgui.FONT_FAMILY;
    de.style.color = amgui.color.text;

    de.setAttribute('data-am-nopick', '');

    var zIndex = getMaxZIndex();
    if (zIndex) {
        de.style.zIndex = zIndex + 1000;
    }

    document.body.appendChild(de);

    var sr = de.createShadowRoot();
        
    sr.appendChild(amgui.getStyleSheet());

    externalStylesheets.forEach(function (css) {

        var style = document.createElement('style');
        style.innerHTML = css;
        //TODO
        sr.appendChild(style);
        // document.head.appendChild(style);
    });

    return sr;
    // return de;
}

function addToggleGui() {

    am.toolbar.addIcon({
        icon: 'resize-small',
        separator: 'first',
        tooltip: 'hide editor',
        onClick: function () {

            am.deGuiCont.style.display = 'none';
            
            document.body.appendChild(btnFull);

            var zIndex = getMaxZIndex();
            if (zIndex) {
                btnFull.style.zIndex = zIndex + 1000;
            }
        }
    });

    var btnFull = amgui.createIconBtn({
        width: 32,
        height: 32,
        fontSize: '32px',
        icon: 'resize-full',
        tooltip: 'show editor',
        onClick: function () {
            
            am.deGuiCont.style.display = 'block';
            btnFull.parentElement.removeChild(btnFull);
        }
    });

    btnFull.style.top = '0px';
    btnFull.style.left = '0px';
    btnFull.style.position = 'fixed';
}

function createAmLayer() {

    var de = document.createElement('div');
    de.style.position = 'fixed';
    de.style.width = '100%';
    de.style.height = '100%';
    de.setAttribute('data-am-nopick', '');
    am.domElem.appendChild(de);
    return de;
}




function getMaxZIndex() {

    var zIndex = 0, els, x, xLen, el, val;

    els = document.querySelectorAll('*');
    for (x = 0, xLen = els.length; x < xLen; x += 1) {
      el = els[x];
      if (window.getComputedStyle(el).getPropertyValue('position') !== 'static') {
        val = window.getComputedStyle(el).getPropertyValue('z-index');
        if (val) {
          val = +val;
          if (val > zIndex) {
            zIndex = val;
          }
        }
      }
    }
    return zIndex;    
}


function getBaseWorkspace() {

    return {
        type: 'container',
        direction: 'column',
        children: [{
                type: 'panel',
                size: 32,
                scaleMode: 'fix',
                noHead: false,
                tabs: [{name: 'tools'}],
            },{
                type: 'container',
                direction: 'row',
                size: 10,
                scaleMode: 'flex',
                children: [{                    
                    type: 'panel',
                    size: 3,
                    scaleMode: 'flex',
                    tabs: [
                        {name: 'Css Style'},
                        {name: 'Dom Tree'}
                    ]
                }, {                    
                    type: 'panel',
                    empty: true,
                    size: 12,
                    scaleMode: 'flex'
                }]
            }, {
                type: 'panel',
                size: 4,
                scaleMode: 'flex',
                noHead: false,
                tabs: [{name: 'timeline'}],
            }]
    };
}

function createStatusLabel() {

    var deTitle = amgui.createLabel({
        caption: 'Animachine (alpha)',
        parent: am.deDialogCont,
        position: 'fixed',
        fontSize: '18px'
    });

    deTitle.style.pointerEvents = 'none';
    deTitle.style.top = '32px';
    deTitle.style.left = '3px';
    deTitle.style.opacity = '0.23';
    deTitle.style.fontWeight = 'bold';
}

function alertUnsupportedBrowsers() {

    var deSorry = document.createElement('div');
    deSorry.textContent = 'Sorry, this demo is currently only supported by chrome. ';
    amgui.createIcon({icon: 'emo-unhappy', parent: deSorry, display: 'inline'});
    deSorry.style.display = 'fixed';
    deSorry.style.margin = 'auto';
    deSorry.style.fontFamily = amgui.FONT_FAMILY;
    deSorry.style.fontSize = '21px';
    deSorry.style.color = amgui.color.text;
    deSorry.style.background = amgui.color.overlay;
    deSorry.style.top = 0;
    deSorry.style.right = 0;
    deSorry.style.bottom = 0;
    deSorry.style.left = 0;
    document.body.innerHTML = '';
    document.body.appendChild(deSorry);
}

///polyfills
if (!Array.prototype.find) {
  Object.defineProperty(Array.prototype, 'find', {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function(predicate) {
      if (this == null) {
        throw new TypeError('Array.prototype.find called on null or undefined');
      }
      if (typeof predicate !== 'function') {
        throw new TypeError('predicate must be a function');
      }
      var list = Object(this);
      var length = list.length >>> 0;
      var thisArg = arguments[1];
      var value;

      for (var i = 0; i < length; i++) {
        if (i in list) {
          value = list[i];
          if (predicate.call(thisArg, value, i, list)) {
            return value;
          }
        }
      }
      return undefined;
    }
  });
}
},{"./am.css":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\am.css","./amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","./chronicler":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\chronicler\\Chronicler.js","./commonDialogs/dialogFeatureDoesntExits":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\commonDialogs\\dialogFeatureDoesntExits.js","./commonDialogs/dialogFeedback":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\commonDialogs\\dialogFeedback.js","./dom-picker":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\dom-picker\\DomPicker.js","./modules/css":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\cssModule.js","./modules/javascript":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\javascript\\jsModule.js","./timeline":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\timeline\\Timeline.js","./toolbar":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\toolbar\\Toolbar.js","./transhand":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\transhand\\Transhand.js","./warehouseman":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\warehouseman\\Warehouseman.js","./windooman":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\windooman\\Windooman.js","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\browserify\\node_modules\\path-browserify\\index.js":[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\browserify\\node_modules\\process\\browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\browserify\\node_modules\\process\\browser.js":[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\browserify\\node_modules\\util\\support\\isBufferBrowser.js":[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\browserify\\node_modules\\util\\util.js":[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\browserify\\node_modules\\util\\support\\isBufferBrowser.js","_process":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\browserify\\node_modules\\process\\browser.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js":[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js":[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\lodash\\dist\\lodash.js":[function(require,module,exports){
(function (global){
/**
 * @license
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modern -o ./dist/lodash.js`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */
;(function() {

  /** Used as a safe reference for `undefined` in pre ES5 environments */
  var undefined;

  /** Used to pool arrays and objects used internally */
  var arrayPool = [],
      objectPool = [];

  /** Used to generate unique IDs */
  var idCounter = 0;

  /** Used to prefix keys to avoid issues with `__proto__` and properties on `Object.prototype` */
  var keyPrefix = +new Date + '';

  /** Used as the size when optimizations are enabled for large arrays */
  var largeArraySize = 75;

  /** Used as the max size of the `arrayPool` and `objectPool` */
  var maxPoolSize = 40;

  /** Used to detect and test whitespace */
  var whitespace = (
    // whitespace
    ' \t\x0B\f\xA0\ufeff' +

    // line terminators
    '\n\r\u2028\u2029' +

    // unicode category "Zs" space separators
    '\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000'
  );

  /** Used to match empty string literals in compiled template source */
  var reEmptyStringLeading = /\b__p \+= '';/g,
      reEmptyStringMiddle = /\b(__p \+=) '' \+/g,
      reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;

  /**
   * Used to match ES6 template delimiters
   * http://people.mozilla.org/~jorendorff/es6-draft.html#sec-literals-string-literals
   */
  var reEsTemplate = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;

  /** Used to match regexp flags from their coerced string values */
  var reFlags = /\w*$/;

  /** Used to detected named functions */
  var reFuncName = /^\s*function[ \n\r\t]+\w/;

  /** Used to match "interpolate" template delimiters */
  var reInterpolate = /<%=([\s\S]+?)%>/g;

  /** Used to match leading whitespace and zeros to be removed */
  var reLeadingSpacesAndZeros = RegExp('^[' + whitespace + ']*0+(?=.$)');

  /** Used to ensure capturing order of template delimiters */
  var reNoMatch = /($^)/;

  /** Used to detect functions containing a `this` reference */
  var reThis = /\bthis\b/;

  /** Used to match unescaped characters in compiled string literals */
  var reUnescapedString = /['\n\r\t\u2028\u2029\\]/g;

  /** Used to assign default `context` object properties */
  var contextProps = [
    'Array', 'Boolean', 'Date', 'Function', 'Math', 'Number', 'Object',
    'RegExp', 'String', '_', 'attachEvent', 'clearTimeout', 'isFinite', 'isNaN',
    'parseInt', 'setTimeout'
  ];

  /** Used to make template sourceURLs easier to identify */
  var templateCounter = 0;

  /** `Object#toString` result shortcuts */
  var argsClass = '[object Arguments]',
      arrayClass = '[object Array]',
      boolClass = '[object Boolean]',
      dateClass = '[object Date]',
      funcClass = '[object Function]',
      numberClass = '[object Number]',
      objectClass = '[object Object]',
      regexpClass = '[object RegExp]',
      stringClass = '[object String]';

  /** Used to identify object classifications that `_.clone` supports */
  var cloneableClasses = {};
  cloneableClasses[funcClass] = false;
  cloneableClasses[argsClass] = cloneableClasses[arrayClass] =
  cloneableClasses[boolClass] = cloneableClasses[dateClass] =
  cloneableClasses[numberClass] = cloneableClasses[objectClass] =
  cloneableClasses[regexpClass] = cloneableClasses[stringClass] = true;

  /** Used as an internal `_.debounce` options object */
  var debounceOptions = {
    'leading': false,
    'maxWait': 0,
    'trailing': false
  };

  /** Used as the property descriptor for `__bindData__` */
  var descriptor = {
    'configurable': false,
    'enumerable': false,
    'value': null,
    'writable': false
  };

  /** Used to determine if values are of the language type Object */
  var objectTypes = {
    'boolean': false,
    'function': true,
    'object': true,
    'number': false,
    'string': false,
    'undefined': false
  };

  /** Used to escape characters for inclusion in compiled string literals */
  var stringEscapes = {
    '\\': '\\',
    "'": "'",
    '\n': 'n',
    '\r': 'r',
    '\t': 't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  /** Used as a reference to the global object */
  var root = (objectTypes[typeof window] && window) || this;

  /** Detect free variable `exports` */
  var freeExports = objectTypes[typeof exports] && exports && !exports.nodeType && exports;

  /** Detect free variable `module` */
  var freeModule = objectTypes[typeof module] && module && !module.nodeType && module;

  /** Detect the popular CommonJS extension `module.exports` */
  var moduleExports = freeModule && freeModule.exports === freeExports && freeExports;

  /** Detect free variable `global` from Node.js or Browserified code and use it as `root` */
  var freeGlobal = objectTypes[typeof global] && global;
  if (freeGlobal && (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal)) {
    root = freeGlobal;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * The base implementation of `_.indexOf` without support for binary searches
   * or `fromIndex` constraints.
   *
   * @private
   * @param {Array} array The array to search.
   * @param {*} value The value to search for.
   * @param {number} [fromIndex=0] The index to search from.
   * @returns {number} Returns the index of the matched value or `-1`.
   */
  function baseIndexOf(array, value, fromIndex) {
    var index = (fromIndex || 0) - 1,
        length = array ? array.length : 0;

    while (++index < length) {
      if (array[index] === value) {
        return index;
      }
    }
    return -1;
  }

  /**
   * An implementation of `_.contains` for cache objects that mimics the return
   * signature of `_.indexOf` by returning `0` if the value is found, else `-1`.
   *
   * @private
   * @param {Object} cache The cache object to inspect.
   * @param {*} value The value to search for.
   * @returns {number} Returns `0` if `value` is found, else `-1`.
   */
  function cacheIndexOf(cache, value) {
    var type = typeof value;
    cache = cache.cache;

    if (type == 'boolean' || value == null) {
      return cache[value] ? 0 : -1;
    }
    if (type != 'number' && type != 'string') {
      type = 'object';
    }
    var key = type == 'number' ? value : keyPrefix + value;
    cache = (cache = cache[type]) && cache[key];

    return type == 'object'
      ? (cache && baseIndexOf(cache, value) > -1 ? 0 : -1)
      : (cache ? 0 : -1);
  }

  /**
   * Adds a given value to the corresponding cache object.
   *
   * @private
   * @param {*} value The value to add to the cache.
   */
  function cachePush(value) {
    var cache = this.cache,
        type = typeof value;

    if (type == 'boolean' || value == null) {
      cache[value] = true;
    } else {
      if (type != 'number' && type != 'string') {
        type = 'object';
      }
      var key = type == 'number' ? value : keyPrefix + value,
          typeCache = cache[type] || (cache[type] = {});

      if (type == 'object') {
        (typeCache[key] || (typeCache[key] = [])).push(value);
      } else {
        typeCache[key] = true;
      }
    }
  }

  /**
   * Used by `_.max` and `_.min` as the default callback when a given
   * collection is a string value.
   *
   * @private
   * @param {string} value The character to inspect.
   * @returns {number} Returns the code unit of given character.
   */
  function charAtCallback(value) {
    return value.charCodeAt(0);
  }

  /**
   * Used by `sortBy` to compare transformed `collection` elements, stable sorting
   * them in ascending order.
   *
   * @private
   * @param {Object} a The object to compare to `b`.
   * @param {Object} b The object to compare to `a`.
   * @returns {number} Returns the sort order indicator of `1` or `-1`.
   */
  function compareAscending(a, b) {
    var ac = a.criteria,
        bc = b.criteria,
        index = -1,
        length = ac.length;

    while (++index < length) {
      var value = ac[index],
          other = bc[index];

      if (value !== other) {
        if (value > other || typeof value == 'undefined') {
          return 1;
        }
        if (value < other || typeof other == 'undefined') {
          return -1;
        }
      }
    }
    // Fixes an `Array#sort` bug in the JS engine embedded in Adobe applications
    // that causes it, under certain circumstances, to return the same value for
    // `a` and `b`. See https://github.com/jashkenas/underscore/pull/1247
    //
    // This also ensures a stable sort in V8 and other engines.
    // See http://code.google.com/p/v8/issues/detail?id=90
    return a.index - b.index;
  }

  /**
   * Creates a cache object to optimize linear searches of large arrays.
   *
   * @private
   * @param {Array} [array=[]] The array to search.
   * @returns {null|Object} Returns the cache object or `null` if caching should not be used.
   */
  function createCache(array) {
    var index = -1,
        length = array.length,
        first = array[0],
        mid = array[(length / 2) | 0],
        last = array[length - 1];

    if (first && typeof first == 'object' &&
        mid && typeof mid == 'object' && last && typeof last == 'object') {
      return false;
    }
    var cache = getObject();
    cache['false'] = cache['null'] = cache['true'] = cache['undefined'] = false;

    var result = getObject();
    result.array = array;
    result.cache = cache;
    result.push = cachePush;

    while (++index < length) {
      result.push(array[index]);
    }
    return result;
  }

  /**
   * Used by `template` to escape characters for inclusion in compiled
   * string literals.
   *
   * @private
   * @param {string} match The matched character to escape.
   * @returns {string} Returns the escaped character.
   */
  function escapeStringChar(match) {
    return '\\' + stringEscapes[match];
  }

  /**
   * Gets an array from the array pool or creates a new one if the pool is empty.
   *
   * @private
   * @returns {Array} The array from the pool.
   */
  function getArray() {
    return arrayPool.pop() || [];
  }

  /**
   * Gets an object from the object pool or creates a new one if the pool is empty.
   *
   * @private
   * @returns {Object} The object from the pool.
   */
  function getObject() {
    return objectPool.pop() || {
      'array': null,
      'cache': null,
      'criteria': null,
      'false': false,
      'index': 0,
      'null': false,
      'number': null,
      'object': null,
      'push': null,
      'string': null,
      'true': false,
      'undefined': false,
      'value': null
    };
  }

  /**
   * Releases the given array back to the array pool.
   *
   * @private
   * @param {Array} [array] The array to release.
   */
  function releaseArray(array) {
    array.length = 0;
    if (arrayPool.length < maxPoolSize) {
      arrayPool.push(array);
    }
  }

  /**
   * Releases the given object back to the object pool.
   *
   * @private
   * @param {Object} [object] The object to release.
   */
  function releaseObject(object) {
    var cache = object.cache;
    if (cache) {
      releaseObject(cache);
    }
    object.array = object.cache = object.criteria = object.object = object.number = object.string = object.value = null;
    if (objectPool.length < maxPoolSize) {
      objectPool.push(object);
    }
  }

  /**
   * Slices the `collection` from the `start` index up to, but not including,
   * the `end` index.
   *
   * Note: This function is used instead of `Array#slice` to support node lists
   * in IE < 9 and to ensure dense arrays are returned.
   *
   * @private
   * @param {Array|Object|string} collection The collection to slice.
   * @param {number} start The start index.
   * @param {number} end The end index.
   * @returns {Array} Returns the new array.
   */
  function slice(array, start, end) {
    start || (start = 0);
    if (typeof end == 'undefined') {
      end = array ? array.length : 0;
    }
    var index = -1,
        length = end - start || 0,
        result = Array(length < 0 ? 0 : length);

    while (++index < length) {
      result[index] = array[start + index];
    }
    return result;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Create a new `lodash` function using the given context object.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Object} [context=root] The context object.
   * @returns {Function} Returns the `lodash` function.
   */
  function runInContext(context) {
    // Avoid issues with some ES3 environments that attempt to use values, named
    // after built-in constructors like `Object`, for the creation of literals.
    // ES5 clears this up by stating that literals must use built-in constructors.
    // See http://es5.github.io/#x11.1.5.
    context = context ? _.defaults(root.Object(), context, _.pick(root, contextProps)) : root;

    /** Native constructor references */
    var Array = context.Array,
        Boolean = context.Boolean,
        Date = context.Date,
        Function = context.Function,
        Math = context.Math,
        Number = context.Number,
        Object = context.Object,
        RegExp = context.RegExp,
        String = context.String,
        TypeError = context.TypeError;

    /**
     * Used for `Array` method references.
     *
     * Normally `Array.prototype` would suffice, however, using an array literal
     * avoids issues in Narwhal.
     */
    var arrayRef = [];

    /** Used for native method references */
    var objectProto = Object.prototype;

    /** Used to restore the original `_` reference in `noConflict` */
    var oldDash = context._;

    /** Used to resolve the internal [[Class]] of values */
    var toString = objectProto.toString;

    /** Used to detect if a method is native */
    var reNative = RegExp('^' +
      String(toString)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/toString| for [^\]]+/g, '.*?') + '$'
    );

    /** Native method shortcuts */
    var ceil = Math.ceil,
        clearTimeout = context.clearTimeout,
        floor = Math.floor,
        fnToString = Function.prototype.toString,
        getPrototypeOf = isNative(getPrototypeOf = Object.getPrototypeOf) && getPrototypeOf,
        hasOwnProperty = objectProto.hasOwnProperty,
        push = arrayRef.push,
        setTimeout = context.setTimeout,
        splice = arrayRef.splice,
        unshift = arrayRef.unshift;

    /** Used to set meta data on functions */
    var defineProperty = (function() {
      // IE 8 only accepts DOM elements
      try {
        var o = {},
            func = isNative(func = Object.defineProperty) && func,
            result = func(o, o, o) && func;
      } catch(e) { }
      return result;
    }());

    /* Native method shortcuts for methods with the same name as other `lodash` methods */
    var nativeCreate = isNative(nativeCreate = Object.create) && nativeCreate,
        nativeIsArray = isNative(nativeIsArray = Array.isArray) && nativeIsArray,
        nativeIsFinite = context.isFinite,
        nativeIsNaN = context.isNaN,
        nativeKeys = isNative(nativeKeys = Object.keys) && nativeKeys,
        nativeMax = Math.max,
        nativeMin = Math.min,
        nativeParseInt = context.parseInt,
        nativeRandom = Math.random;

    /** Used to lookup a built-in constructor by [[Class]] */
    var ctorByClass = {};
    ctorByClass[arrayClass] = Array;
    ctorByClass[boolClass] = Boolean;
    ctorByClass[dateClass] = Date;
    ctorByClass[funcClass] = Function;
    ctorByClass[objectClass] = Object;
    ctorByClass[numberClass] = Number;
    ctorByClass[regexpClass] = RegExp;
    ctorByClass[stringClass] = String;

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a `lodash` object which wraps the given value to enable intuitive
     * method chaining.
     *
     * In addition to Lo-Dash methods, wrappers also have the following `Array` methods:
     * `concat`, `join`, `pop`, `push`, `reverse`, `shift`, `slice`, `sort`, `splice`,
     * and `unshift`
     *
     * Chaining is supported in custom builds as long as the `value` method is
     * implicitly or explicitly included in the build.
     *
     * The chainable wrapper functions are:
     * `after`, `assign`, `bind`, `bindAll`, `bindKey`, `chain`, `compact`,
     * `compose`, `concat`, `countBy`, `create`, `createCallback`, `curry`,
     * `debounce`, `defaults`, `defer`, `delay`, `difference`, `filter`, `flatten`,
     * `forEach`, `forEachRight`, `forIn`, `forInRight`, `forOwn`, `forOwnRight`,
     * `functions`, `groupBy`, `indexBy`, `initial`, `intersection`, `invert`,
     * `invoke`, `keys`, `map`, `max`, `memoize`, `merge`, `min`, `object`, `omit`,
     * `once`, `pairs`, `partial`, `partialRight`, `pick`, `pluck`, `pull`, `push`,
     * `range`, `reject`, `remove`, `rest`, `reverse`, `shuffle`, `slice`, `sort`,
     * `sortBy`, `splice`, `tap`, `throttle`, `times`, `toArray`, `transform`,
     * `union`, `uniq`, `unshift`, `unzip`, `values`, `where`, `without`, `wrap`,
     * and `zip`
     *
     * The non-chainable wrapper functions are:
     * `clone`, `cloneDeep`, `contains`, `escape`, `every`, `find`, `findIndex`,
     * `findKey`, `findLast`, `findLastIndex`, `findLastKey`, `has`, `identity`,
     * `indexOf`, `isArguments`, `isArray`, `isBoolean`, `isDate`, `isElement`,
     * `isEmpty`, `isEqual`, `isFinite`, `isFunction`, `isNaN`, `isNull`, `isNumber`,
     * `isObject`, `isPlainObject`, `isRegExp`, `isString`, `isUndefined`, `join`,
     * `lastIndexOf`, `mixin`, `noConflict`, `parseInt`, `pop`, `random`, `reduce`,
     * `reduceRight`, `result`, `shift`, `size`, `some`, `sortedIndex`, `runInContext`,
     * `template`, `unescape`, `uniqueId`, and `value`
     *
     * The wrapper functions `first` and `last` return wrapped values when `n` is
     * provided, otherwise they return unwrapped values.
     *
     * Explicit chaining can be enabled by using the `_.chain` method.
     *
     * @name _
     * @constructor
     * @category Chaining
     * @param {*} value The value to wrap in a `lodash` instance.
     * @returns {Object} Returns a `lodash` instance.
     * @example
     *
     * var wrapped = _([1, 2, 3]);
     *
     * // returns an unwrapped value
     * wrapped.reduce(function(sum, num) {
     *   return sum + num;
     * });
     * // => 6
     *
     * // returns a wrapped value
     * var squares = wrapped.map(function(num) {
     *   return num * num;
     * });
     *
     * _.isArray(squares);
     * // => false
     *
     * _.isArray(squares.value());
     * // => true
     */
    function lodash(value) {
      // don't wrap if already wrapped, even if wrapped by a different `lodash` constructor
      return (value && typeof value == 'object' && !isArray(value) && hasOwnProperty.call(value, '__wrapped__'))
       ? value
       : new lodashWrapper(value);
    }

    /**
     * A fast path for creating `lodash` wrapper objects.
     *
     * @private
     * @param {*} value The value to wrap in a `lodash` instance.
     * @param {boolean} chainAll A flag to enable chaining for all methods
     * @returns {Object} Returns a `lodash` instance.
     */
    function lodashWrapper(value, chainAll) {
      this.__chain__ = !!chainAll;
      this.__wrapped__ = value;
    }
    // ensure `new lodashWrapper` is an instance of `lodash`
    lodashWrapper.prototype = lodash.prototype;

    /**
     * An object used to flag environments features.
     *
     * @static
     * @memberOf _
     * @type Object
     */
    var support = lodash.support = {};

    /**
     * Detect if functions can be decompiled by `Function#toString`
     * (all but PS3 and older Opera mobile browsers & avoided in Windows 8 apps).
     *
     * @memberOf _.support
     * @type boolean
     */
    support.funcDecomp = !isNative(context.WinRTError) && reThis.test(runInContext);

    /**
     * Detect if `Function#name` is supported (all but IE).
     *
     * @memberOf _.support
     * @type boolean
     */
    support.funcNames = typeof Function.name == 'string';

    /**
     * By default, the template delimiters used by Lo-Dash are similar to those in
     * embedded Ruby (ERB). Change the following template settings to use alternative
     * delimiters.
     *
     * @static
     * @memberOf _
     * @type Object
     */
    lodash.templateSettings = {

      /**
       * Used to detect `data` property values to be HTML-escaped.
       *
       * @memberOf _.templateSettings
       * @type RegExp
       */
      'escape': /<%-([\s\S]+?)%>/g,

      /**
       * Used to detect code to be evaluated.
       *
       * @memberOf _.templateSettings
       * @type RegExp
       */
      'evaluate': /<%([\s\S]+?)%>/g,

      /**
       * Used to detect `data` property values to inject.
       *
       * @memberOf _.templateSettings
       * @type RegExp
       */
      'interpolate': reInterpolate,

      /**
       * Used to reference the data object in the template text.
       *
       * @memberOf _.templateSettings
       * @type string
       */
      'variable': '',

      /**
       * Used to import variables into the compiled template.
       *
       * @memberOf _.templateSettings
       * @type Object
       */
      'imports': {

        /**
         * A reference to the `lodash` function.
         *
         * @memberOf _.templateSettings.imports
         * @type Function
         */
        '_': lodash
      }
    };

    /*--------------------------------------------------------------------------*/

    /**
     * The base implementation of `_.bind` that creates the bound function and
     * sets its meta data.
     *
     * @private
     * @param {Array} bindData The bind data array.
     * @returns {Function} Returns the new bound function.
     */
    function baseBind(bindData) {
      var func = bindData[0],
          partialArgs = bindData[2],
          thisArg = bindData[4];

      function bound() {
        // `Function#bind` spec
        // http://es5.github.io/#x15.3.4.5
        if (partialArgs) {
          // avoid `arguments` object deoptimizations by using `slice` instead
          // of `Array.prototype.slice.call` and not assigning `arguments` to a
          // variable as a ternary expression
          var args = slice(partialArgs);
          push.apply(args, arguments);
        }
        // mimic the constructor's `return` behavior
        // http://es5.github.io/#x13.2.2
        if (this instanceof bound) {
          // ensure `new bound` is an instance of `func`
          var thisBinding = baseCreate(func.prototype),
              result = func.apply(thisBinding, args || arguments);
          return isObject(result) ? result : thisBinding;
        }
        return func.apply(thisArg, args || arguments);
      }
      setBindData(bound, bindData);
      return bound;
    }

    /**
     * The base implementation of `_.clone` without argument juggling or support
     * for `thisArg` binding.
     *
     * @private
     * @param {*} value The value to clone.
     * @param {boolean} [isDeep=false] Specify a deep clone.
     * @param {Function} [callback] The function to customize cloning values.
     * @param {Array} [stackA=[]] Tracks traversed source objects.
     * @param {Array} [stackB=[]] Associates clones with source counterparts.
     * @returns {*} Returns the cloned value.
     */
    function baseClone(value, isDeep, callback, stackA, stackB) {
      if (callback) {
        var result = callback(value);
        if (typeof result != 'undefined') {
          return result;
        }
      }
      // inspect [[Class]]
      var isObj = isObject(value);
      if (isObj) {
        var className = toString.call(value);
        if (!cloneableClasses[className]) {
          return value;
        }
        var ctor = ctorByClass[className];
        switch (className) {
          case boolClass:
          case dateClass:
            return new ctor(+value);

          case numberClass:
          case stringClass:
            return new ctor(value);

          case regexpClass:
            result = ctor(value.source, reFlags.exec(value));
            result.lastIndex = value.lastIndex;
            return result;
        }
      } else {
        return value;
      }
      var isArr = isArray(value);
      if (isDeep) {
        // check for circular references and return corresponding clone
        var initedStack = !stackA;
        stackA || (stackA = getArray());
        stackB || (stackB = getArray());

        var length = stackA.length;
        while (length--) {
          if (stackA[length] == value) {
            return stackB[length];
          }
        }
        result = isArr ? ctor(value.length) : {};
      }
      else {
        result = isArr ? slice(value) : assign({}, value);
      }
      // add array properties assigned by `RegExp#exec`
      if (isArr) {
        if (hasOwnProperty.call(value, 'index')) {
          result.index = value.index;
        }
        if (hasOwnProperty.call(value, 'input')) {
          result.input = value.input;
        }
      }
      // exit for shallow clone
      if (!isDeep) {
        return result;
      }
      // add the source value to the stack of traversed objects
      // and associate it with its clone
      stackA.push(value);
      stackB.push(result);

      // recursively populate clone (susceptible to call stack limits)
      (isArr ? forEach : forOwn)(value, function(objValue, key) {
        result[key] = baseClone(objValue, isDeep, callback, stackA, stackB);
      });

      if (initedStack) {
        releaseArray(stackA);
        releaseArray(stackB);
      }
      return result;
    }

    /**
     * The base implementation of `_.create` without support for assigning
     * properties to the created object.
     *
     * @private
     * @param {Object} prototype The object to inherit from.
     * @returns {Object} Returns the new object.
     */
    function baseCreate(prototype, properties) {
      return isObject(prototype) ? nativeCreate(prototype) : {};
    }
    // fallback for browsers without `Object.create`
    if (!nativeCreate) {
      baseCreate = (function() {
        function Object() {}
        return function(prototype) {
          if (isObject(prototype)) {
            Object.prototype = prototype;
            var result = new Object;
            Object.prototype = null;
          }
          return result || context.Object();
        };
      }());
    }

    /**
     * The base implementation of `_.createCallback` without support for creating
     * "_.pluck" or "_.where" style callbacks.
     *
     * @private
     * @param {*} [func=identity] The value to convert to a callback.
     * @param {*} [thisArg] The `this` binding of the created callback.
     * @param {number} [argCount] The number of arguments the callback accepts.
     * @returns {Function} Returns a callback function.
     */
    function baseCreateCallback(func, thisArg, argCount) {
      if (typeof func != 'function') {
        return identity;
      }
      // exit early for no `thisArg` or already bound by `Function#bind`
      if (typeof thisArg == 'undefined' || !('prototype' in func)) {
        return func;
      }
      var bindData = func.__bindData__;
      if (typeof bindData == 'undefined') {
        if (support.funcNames) {
          bindData = !func.name;
        }
        bindData = bindData || !support.funcDecomp;
        if (!bindData) {
          var source = fnToString.call(func);
          if (!support.funcNames) {
            bindData = !reFuncName.test(source);
          }
          if (!bindData) {
            // checks if `func` references the `this` keyword and stores the result
            bindData = reThis.test(source);
            setBindData(func, bindData);
          }
        }
      }
      // exit early if there are no `this` references or `func` is bound
      if (bindData === false || (bindData !== true && bindData[1] & 1)) {
        return func;
      }
      switch (argCount) {
        case 1: return function(value) {
          return func.call(thisArg, value);
        };
        case 2: return function(a, b) {
          return func.call(thisArg, a, b);
        };
        case 3: return function(value, index, collection) {
          return func.call(thisArg, value, index, collection);
        };
        case 4: return function(accumulator, value, index, collection) {
          return func.call(thisArg, accumulator, value, index, collection);
        };
      }
      return bind(func, thisArg);
    }

    /**
     * The base implementation of `createWrapper` that creates the wrapper and
     * sets its meta data.
     *
     * @private
     * @param {Array} bindData The bind data array.
     * @returns {Function} Returns the new function.
     */
    function baseCreateWrapper(bindData) {
      var func = bindData[0],
          bitmask = bindData[1],
          partialArgs = bindData[2],
          partialRightArgs = bindData[3],
          thisArg = bindData[4],
          arity = bindData[5];

      var isBind = bitmask & 1,
          isBindKey = bitmask & 2,
          isCurry = bitmask & 4,
          isCurryBound = bitmask & 8,
          key = func;

      function bound() {
        var thisBinding = isBind ? thisArg : this;
        if (partialArgs) {
          var args = slice(partialArgs);
          push.apply(args, arguments);
        }
        if (partialRightArgs || isCurry) {
          args || (args = slice(arguments));
          if (partialRightArgs) {
            push.apply(args, partialRightArgs);
          }
          if (isCurry && args.length < arity) {
            bitmask |= 16 & ~32;
            return baseCreateWrapper([func, (isCurryBound ? bitmask : bitmask & ~3), args, null, thisArg, arity]);
          }
        }
        args || (args = arguments);
        if (isBindKey) {
          func = thisBinding[key];
        }
        if (this instanceof bound) {
          thisBinding = baseCreate(func.prototype);
          var result = func.apply(thisBinding, args);
          return isObject(result) ? result : thisBinding;
        }
        return func.apply(thisBinding, args);
      }
      setBindData(bound, bindData);
      return bound;
    }

    /**
     * The base implementation of `_.difference` that accepts a single array
     * of values to exclude.
     *
     * @private
     * @param {Array} array The array to process.
     * @param {Array} [values] The array of values to exclude.
     * @returns {Array} Returns a new array of filtered values.
     */
    function baseDifference(array, values) {
      var index = -1,
          indexOf = getIndexOf(),
          length = array ? array.length : 0,
          isLarge = length >= largeArraySize && indexOf === baseIndexOf,
          result = [];

      if (isLarge) {
        var cache = createCache(values);
        if (cache) {
          indexOf = cacheIndexOf;
          values = cache;
        } else {
          isLarge = false;
        }
      }
      while (++index < length) {
        var value = array[index];
        if (indexOf(values, value) < 0) {
          result.push(value);
        }
      }
      if (isLarge) {
        releaseObject(values);
      }
      return result;
    }

    /**
     * The base implementation of `_.flatten` without support for callback
     * shorthands or `thisArg` binding.
     *
     * @private
     * @param {Array} array The array to flatten.
     * @param {boolean} [isShallow=false] A flag to restrict flattening to a single level.
     * @param {boolean} [isStrict=false] A flag to restrict flattening to arrays and `arguments` objects.
     * @param {number} [fromIndex=0] The index to start from.
     * @returns {Array} Returns a new flattened array.
     */
    function baseFlatten(array, isShallow, isStrict, fromIndex) {
      var index = (fromIndex || 0) - 1,
          length = array ? array.length : 0,
          result = [];

      while (++index < length) {
        var value = array[index];

        if (value && typeof value == 'object' && typeof value.length == 'number'
            && (isArray(value) || isArguments(value))) {
          // recursively flatten arrays (susceptible to call stack limits)
          if (!isShallow) {
            value = baseFlatten(value, isShallow, isStrict);
          }
          var valIndex = -1,
              valLength = value.length,
              resIndex = result.length;

          result.length += valLength;
          while (++valIndex < valLength) {
            result[resIndex++] = value[valIndex];
          }
        } else if (!isStrict) {
          result.push(value);
        }
      }
      return result;
    }

    /**
     * The base implementation of `_.isEqual`, without support for `thisArg` binding,
     * that allows partial "_.where" style comparisons.
     *
     * @private
     * @param {*} a The value to compare.
     * @param {*} b The other value to compare.
     * @param {Function} [callback] The function to customize comparing values.
     * @param {Function} [isWhere=false] A flag to indicate performing partial comparisons.
     * @param {Array} [stackA=[]] Tracks traversed `a` objects.
     * @param {Array} [stackB=[]] Tracks traversed `b` objects.
     * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
     */
    function baseIsEqual(a, b, callback, isWhere, stackA, stackB) {
      // used to indicate that when comparing objects, `a` has at least the properties of `b`
      if (callback) {
        var result = callback(a, b);
        if (typeof result != 'undefined') {
          return !!result;
        }
      }
      // exit early for identical values
      if (a === b) {
        // treat `+0` vs. `-0` as not equal
        return a !== 0 || (1 / a == 1 / b);
      }
      var type = typeof a,
          otherType = typeof b;

      // exit early for unlike primitive values
      if (a === a &&
          !(a && objectTypes[type]) &&
          !(b && objectTypes[otherType])) {
        return false;
      }
      // exit early for `null` and `undefined` avoiding ES3's Function#call behavior
      // http://es5.github.io/#x15.3.4.4
      if (a == null || b == null) {
        return a === b;
      }
      // compare [[Class]] names
      var className = toString.call(a),
          otherClass = toString.call(b);

      if (className == argsClass) {
        className = objectClass;
      }
      if (otherClass == argsClass) {
        otherClass = objectClass;
      }
      if (className != otherClass) {
        return false;
      }
      switch (className) {
        case boolClass:
        case dateClass:
          // coerce dates and booleans to numbers, dates to milliseconds and booleans
          // to `1` or `0` treating invalid dates coerced to `NaN` as not equal
          return +a == +b;

        case numberClass:
          // treat `NaN` vs. `NaN` as equal
          return (a != +a)
            ? b != +b
            // but treat `+0` vs. `-0` as not equal
            : (a == 0 ? (1 / a == 1 / b) : a == +b);

        case regexpClass:
        case stringClass:
          // coerce regexes to strings (http://es5.github.io/#x15.10.6.4)
          // treat string primitives and their corresponding object instances as equal
          return a == String(b);
      }
      var isArr = className == arrayClass;
      if (!isArr) {
        // unwrap any `lodash` wrapped values
        var aWrapped = hasOwnProperty.call(a, '__wrapped__'),
            bWrapped = hasOwnProperty.call(b, '__wrapped__');

        if (aWrapped || bWrapped) {
          return baseIsEqual(aWrapped ? a.__wrapped__ : a, bWrapped ? b.__wrapped__ : b, callback, isWhere, stackA, stackB);
        }
        // exit for functions and DOM nodes
        if (className != objectClass) {
          return false;
        }
        // in older versions of Opera, `arguments` objects have `Array` constructors
        var ctorA = a.constructor,
            ctorB = b.constructor;

        // non `Object` object instances with different constructors are not equal
        if (ctorA != ctorB &&
              !(isFunction(ctorA) && ctorA instanceof ctorA && isFunction(ctorB) && ctorB instanceof ctorB) &&
              ('constructor' in a && 'constructor' in b)
            ) {
          return false;
        }
      }
      // assume cyclic structures are equal
      // the algorithm for detecting cyclic structures is adapted from ES 5.1
      // section 15.12.3, abstract operation `JO` (http://es5.github.io/#x15.12.3)
      var initedStack = !stackA;
      stackA || (stackA = getArray());
      stackB || (stackB = getArray());

      var length = stackA.length;
      while (length--) {
        if (stackA[length] == a) {
          return stackB[length] == b;
        }
      }
      var size = 0;
      result = true;

      // add `a` and `b` to the stack of traversed objects
      stackA.push(a);
      stackB.push(b);

      // recursively compare objects and arrays (susceptible to call stack limits)
      if (isArr) {
        // compare lengths to determine if a deep comparison is necessary
        length = a.length;
        size = b.length;
        result = size == length;

        if (result || isWhere) {
          // deep compare the contents, ignoring non-numeric properties
          while (size--) {
            var index = length,
                value = b[size];

            if (isWhere) {
              while (index--) {
                if ((result = baseIsEqual(a[index], value, callback, isWhere, stackA, stackB))) {
                  break;
                }
              }
            } else if (!(result = baseIsEqual(a[size], value, callback, isWhere, stackA, stackB))) {
              break;
            }
          }
        }
      }
      else {
        // deep compare objects using `forIn`, instead of `forOwn`, to avoid `Object.keys`
        // which, in this case, is more costly
        forIn(b, function(value, key, b) {
          if (hasOwnProperty.call(b, key)) {
            // count the number of properties.
            size++;
            // deep compare each property value.
            return (result = hasOwnProperty.call(a, key) && baseIsEqual(a[key], value, callback, isWhere, stackA, stackB));
          }
        });

        if (result && !isWhere) {
          // ensure both objects have the same number of properties
          forIn(a, function(value, key, a) {
            if (hasOwnProperty.call(a, key)) {
              // `size` will be `-1` if `a` has more properties than `b`
              return (result = --size > -1);
            }
          });
        }
      }
      stackA.pop();
      stackB.pop();

      if (initedStack) {
        releaseArray(stackA);
        releaseArray(stackB);
      }
      return result;
    }

    /**
     * The base implementation of `_.merge` without argument juggling or support
     * for `thisArg` binding.
     *
     * @private
     * @param {Object} object The destination object.
     * @param {Object} source The source object.
     * @param {Function} [callback] The function to customize merging properties.
     * @param {Array} [stackA=[]] Tracks traversed source objects.
     * @param {Array} [stackB=[]] Associates values with source counterparts.
     */
    function baseMerge(object, source, callback, stackA, stackB) {
      (isArray(source) ? forEach : forOwn)(source, function(source, key) {
        var found,
            isArr,
            result = source,
            value = object[key];

        if (source && ((isArr = isArray(source)) || isPlainObject(source))) {
          // avoid merging previously merged cyclic sources
          var stackLength = stackA.length;
          while (stackLength--) {
            if ((found = stackA[stackLength] == source)) {
              value = stackB[stackLength];
              break;
            }
          }
          if (!found) {
            var isShallow;
            if (callback) {
              result = callback(value, source);
              if ((isShallow = typeof result != 'undefined')) {
                value = result;
              }
            }
            if (!isShallow) {
              value = isArr
                ? (isArray(value) ? value : [])
                : (isPlainObject(value) ? value : {});
            }
            // add `source` and associated `value` to the stack of traversed objects
            stackA.push(source);
            stackB.push(value);

            // recursively merge objects and arrays (susceptible to call stack limits)
            if (!isShallow) {
              baseMerge(value, source, callback, stackA, stackB);
            }
          }
        }
        else {
          if (callback) {
            result = callback(value, source);
            if (typeof result == 'undefined') {
              result = source;
            }
          }
          if (typeof result != 'undefined') {
            value = result;
          }
        }
        object[key] = value;
      });
    }

    /**
     * The base implementation of `_.random` without argument juggling or support
     * for returning floating-point numbers.
     *
     * @private
     * @param {number} min The minimum possible value.
     * @param {number} max The maximum possible value.
     * @returns {number} Returns a random number.
     */
    function baseRandom(min, max) {
      return min + floor(nativeRandom() * (max - min + 1));
    }

    /**
     * The base implementation of `_.uniq` without support for callback shorthands
     * or `thisArg` binding.
     *
     * @private
     * @param {Array} array The array to process.
     * @param {boolean} [isSorted=false] A flag to indicate that `array` is sorted.
     * @param {Function} [callback] The function called per iteration.
     * @returns {Array} Returns a duplicate-value-free array.
     */
    function baseUniq(array, isSorted, callback) {
      var index = -1,
          indexOf = getIndexOf(),
          length = array ? array.length : 0,
          result = [];

      var isLarge = !isSorted && length >= largeArraySize && indexOf === baseIndexOf,
          seen = (callback || isLarge) ? getArray() : result;

      if (isLarge) {
        var cache = createCache(seen);
        indexOf = cacheIndexOf;
        seen = cache;
      }
      while (++index < length) {
        var value = array[index],
            computed = callback ? callback(value, index, array) : value;

        if (isSorted
              ? !index || seen[seen.length - 1] !== computed
              : indexOf(seen, computed) < 0
            ) {
          if (callback || isLarge) {
            seen.push(computed);
          }
          result.push(value);
        }
      }
      if (isLarge) {
        releaseArray(seen.array);
        releaseObject(seen);
      } else if (callback) {
        releaseArray(seen);
      }
      return result;
    }

    /**
     * Creates a function that aggregates a collection, creating an object composed
     * of keys generated from the results of running each element of the collection
     * through a callback. The given `setter` function sets the keys and values
     * of the composed object.
     *
     * @private
     * @param {Function} setter The setter function.
     * @returns {Function} Returns the new aggregator function.
     */
    function createAggregator(setter) {
      return function(collection, callback, thisArg) {
        var result = {};
        callback = lodash.createCallback(callback, thisArg, 3);

        var index = -1,
            length = collection ? collection.length : 0;

        if (typeof length == 'number') {
          while (++index < length) {
            var value = collection[index];
            setter(result, value, callback(value, index, collection), collection);
          }
        } else {
          forOwn(collection, function(value, key, collection) {
            setter(result, value, callback(value, key, collection), collection);
          });
        }
        return result;
      };
    }

    /**
     * Creates a function that, when called, either curries or invokes `func`
     * with an optional `this` binding and partially applied arguments.
     *
     * @private
     * @param {Function|string} func The function or method name to reference.
     * @param {number} bitmask The bitmask of method flags to compose.
     *  The bitmask may be composed of the following flags:
     *  1 - `_.bind`
     *  2 - `_.bindKey`
     *  4 - `_.curry`
     *  8 - `_.curry` (bound)
     *  16 - `_.partial`
     *  32 - `_.partialRight`
     * @param {Array} [partialArgs] An array of arguments to prepend to those
     *  provided to the new function.
     * @param {Array} [partialRightArgs] An array of arguments to append to those
     *  provided to the new function.
     * @param {*} [thisArg] The `this` binding of `func`.
     * @param {number} [arity] The arity of `func`.
     * @returns {Function} Returns the new function.
     */
    function createWrapper(func, bitmask, partialArgs, partialRightArgs, thisArg, arity) {
      var isBind = bitmask & 1,
          isBindKey = bitmask & 2,
          isCurry = bitmask & 4,
          isCurryBound = bitmask & 8,
          isPartial = bitmask & 16,
          isPartialRight = bitmask & 32;

      if (!isBindKey && !isFunction(func)) {
        throw new TypeError;
      }
      if (isPartial && !partialArgs.length) {
        bitmask &= ~16;
        isPartial = partialArgs = false;
      }
      if (isPartialRight && !partialRightArgs.length) {
        bitmask &= ~32;
        isPartialRight = partialRightArgs = false;
      }
      var bindData = func && func.__bindData__;
      if (bindData && bindData !== true) {
        // clone `bindData`
        bindData = slice(bindData);
        if (bindData[2]) {
          bindData[2] = slice(bindData[2]);
        }
        if (bindData[3]) {
          bindData[3] = slice(bindData[3]);
        }
        // set `thisBinding` is not previously bound
        if (isBind && !(bindData[1] & 1)) {
          bindData[4] = thisArg;
        }
        // set if previously bound but not currently (subsequent curried functions)
        if (!isBind && bindData[1] & 1) {
          bitmask |= 8;
        }
        // set curried arity if not yet set
        if (isCurry && !(bindData[1] & 4)) {
          bindData[5] = arity;
        }
        // append partial left arguments
        if (isPartial) {
          push.apply(bindData[2] || (bindData[2] = []), partialArgs);
        }
        // append partial right arguments
        if (isPartialRight) {
          unshift.apply(bindData[3] || (bindData[3] = []), partialRightArgs);
        }
        // merge flags
        bindData[1] |= bitmask;
        return createWrapper.apply(null, bindData);
      }
      // fast path for `_.bind`
      var creater = (bitmask == 1 || bitmask === 17) ? baseBind : baseCreateWrapper;
      return creater([func, bitmask, partialArgs, partialRightArgs, thisArg, arity]);
    }

    /**
     * Used by `escape` to convert characters to HTML entities.
     *
     * @private
     * @param {string} match The matched character to escape.
     * @returns {string} Returns the escaped character.
     */
    function escapeHtmlChar(match) {
      return htmlEscapes[match];
    }

    /**
     * Gets the appropriate "indexOf" function. If the `_.indexOf` method is
     * customized, this method returns the custom method, otherwise it returns
     * the `baseIndexOf` function.
     *
     * @private
     * @returns {Function} Returns the "indexOf" function.
     */
    function getIndexOf() {
      var result = (result = lodash.indexOf) === indexOf ? baseIndexOf : result;
      return result;
    }

    /**
     * Checks if `value` is a native function.
     *
     * @private
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a native function, else `false`.
     */
    function isNative(value) {
      return typeof value == 'function' && reNative.test(value);
    }

    /**
     * Sets `this` binding data on a given function.
     *
     * @private
     * @param {Function} func The function to set data on.
     * @param {Array} value The data array to set.
     */
    var setBindData = !defineProperty ? noop : function(func, value) {
      descriptor.value = value;
      defineProperty(func, '__bindData__', descriptor);
    };

    /**
     * A fallback implementation of `isPlainObject` which checks if a given value
     * is an object created by the `Object` constructor, assuming objects created
     * by the `Object` constructor have no inherited enumerable properties and that
     * there are no `Object.prototype` extensions.
     *
     * @private
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
     */
    function shimIsPlainObject(value) {
      var ctor,
          result;

      // avoid non Object objects, `arguments` objects, and DOM elements
      if (!(value && toString.call(value) == objectClass) ||
          (ctor = value.constructor, isFunction(ctor) && !(ctor instanceof ctor))) {
        return false;
      }
      // In most environments an object's own properties are iterated before
      // its inherited properties. If the last iterated property is an object's
      // own property then there are no inherited enumerable properties.
      forIn(value, function(value, key) {
        result = key;
      });
      return typeof result == 'undefined' || hasOwnProperty.call(value, result);
    }

    /**
     * Used by `unescape` to convert HTML entities to characters.
     *
     * @private
     * @param {string} match The matched character to unescape.
     * @returns {string} Returns the unescaped character.
     */
    function unescapeHtmlChar(match) {
      return htmlUnescapes[match];
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Checks if `value` is an `arguments` object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is an `arguments` object, else `false`.
     * @example
     *
     * (function() { return _.isArguments(arguments); })(1, 2, 3);
     * // => true
     *
     * _.isArguments([1, 2, 3]);
     * // => false
     */
    function isArguments(value) {
      return value && typeof value == 'object' && typeof value.length == 'number' &&
        toString.call(value) == argsClass || false;
    }

    /**
     * Checks if `value` is an array.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is an array, else `false`.
     * @example
     *
     * (function() { return _.isArray(arguments); })();
     * // => false
     *
     * _.isArray([1, 2, 3]);
     * // => true
     */
    var isArray = nativeIsArray || function(value) {
      return value && typeof value == 'object' && typeof value.length == 'number' &&
        toString.call(value) == arrayClass || false;
    };

    /**
     * A fallback implementation of `Object.keys` which produces an array of the
     * given object's own enumerable property names.
     *
     * @private
     * @type Function
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property names.
     */
    var shimKeys = function(object) {
      var index, iterable = object, result = [];
      if (!iterable) return result;
      if (!(objectTypes[typeof object])) return result;
        for (index in iterable) {
          if (hasOwnProperty.call(iterable, index)) {
            result.push(index);
          }
        }
      return result
    };

    /**
     * Creates an array composed of the own enumerable property names of an object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property names.
     * @example
     *
     * _.keys({ 'one': 1, 'two': 2, 'three': 3 });
     * // => ['one', 'two', 'three'] (property order is not guaranteed across environments)
     */
    var keys = !nativeKeys ? shimKeys : function(object) {
      if (!isObject(object)) {
        return [];
      }
      return nativeKeys(object);
    };

    /**
     * Used to convert characters to HTML entities:
     *
     * Though the `>` character is escaped for symmetry, characters like `>` and `/`
     * don't require escaping in HTML and have no special meaning unless they're part
     * of a tag or an unquoted attribute value.
     * http://mathiasbynens.be/notes/ambiguous-ampersands (under "semi-related fun fact")
     */
    var htmlEscapes = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    /** Used to convert HTML entities to characters */
    var htmlUnescapes = invert(htmlEscapes);

    /** Used to match HTML entities and HTML characters */
    var reEscapedHtml = RegExp('(' + keys(htmlUnescapes).join('|') + ')', 'g'),
        reUnescapedHtml = RegExp('[' + keys(htmlEscapes).join('') + ']', 'g');

    /*--------------------------------------------------------------------------*/

    /**
     * Assigns own enumerable properties of source object(s) to the destination
     * object. Subsequent sources will overwrite property assignments of previous
     * sources. If a callback is provided it will be executed to produce the
     * assigned values. The callback is bound to `thisArg` and invoked with two
     * arguments; (objectValue, sourceValue).
     *
     * @static
     * @memberOf _
     * @type Function
     * @alias extend
     * @category Objects
     * @param {Object} object The destination object.
     * @param {...Object} [source] The source objects.
     * @param {Function} [callback] The function to customize assigning values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the destination object.
     * @example
     *
     * _.assign({ 'name': 'fred' }, { 'employer': 'slate' });
     * // => { 'name': 'fred', 'employer': 'slate' }
     *
     * var defaults = _.partialRight(_.assign, function(a, b) {
     *   return typeof a == 'undefined' ? b : a;
     * });
     *
     * var object = { 'name': 'barney' };
     * defaults(object, { 'name': 'fred', 'employer': 'slate' });
     * // => { 'name': 'barney', 'employer': 'slate' }
     */
    var assign = function(object, source, guard) {
      var index, iterable = object, result = iterable;
      if (!iterable) return result;
      var args = arguments,
          argsIndex = 0,
          argsLength = typeof guard == 'number' ? 2 : args.length;
      if (argsLength > 3 && typeof args[argsLength - 2] == 'function') {
        var callback = baseCreateCallback(args[--argsLength - 1], args[argsLength--], 2);
      } else if (argsLength > 2 && typeof args[argsLength - 1] == 'function') {
        callback = args[--argsLength];
      }
      while (++argsIndex < argsLength) {
        iterable = args[argsIndex];
        if (iterable && objectTypes[typeof iterable]) {
        var ownIndex = -1,
            ownProps = objectTypes[typeof iterable] && keys(iterable),
            length = ownProps ? ownProps.length : 0;

        while (++ownIndex < length) {
          index = ownProps[ownIndex];
          result[index] = callback ? callback(result[index], iterable[index]) : iterable[index];
        }
        }
      }
      return result
    };

    /**
     * Creates a clone of `value`. If `isDeep` is `true` nested objects will also
     * be cloned, otherwise they will be assigned by reference. If a callback
     * is provided it will be executed to produce the cloned values. If the
     * callback returns `undefined` cloning will be handled by the method instead.
     * The callback is bound to `thisArg` and invoked with one argument; (value).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to clone.
     * @param {boolean} [isDeep=false] Specify a deep clone.
     * @param {Function} [callback] The function to customize cloning values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the cloned value.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * var shallow = _.clone(characters);
     * shallow[0] === characters[0];
     * // => true
     *
     * var deep = _.clone(characters, true);
     * deep[0] === characters[0];
     * // => false
     *
     * _.mixin({
     *   'clone': _.partialRight(_.clone, function(value) {
     *     return _.isElement(value) ? value.cloneNode(false) : undefined;
     *   })
     * });
     *
     * var clone = _.clone(document.body);
     * clone.childNodes.length;
     * // => 0
     */
    function clone(value, isDeep, callback, thisArg) {
      // allows working with "Collections" methods without using their `index`
      // and `collection` arguments for `isDeep` and `callback`
      if (typeof isDeep != 'boolean' && isDeep != null) {
        thisArg = callback;
        callback = isDeep;
        isDeep = false;
      }
      return baseClone(value, isDeep, typeof callback == 'function' && baseCreateCallback(callback, thisArg, 1));
    }

    /**
     * Creates a deep clone of `value`. If a callback is provided it will be
     * executed to produce the cloned values. If the callback returns `undefined`
     * cloning will be handled by the method instead. The callback is bound to
     * `thisArg` and invoked with one argument; (value).
     *
     * Note: This method is loosely based on the structured clone algorithm. Functions
     * and DOM nodes are **not** cloned. The enumerable properties of `arguments` objects and
     * objects created by constructors other than `Object` are cloned to plain `Object` objects.
     * See http://www.w3.org/TR/html5/infrastructure.html#internal-structured-cloning-algorithm.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to deep clone.
     * @param {Function} [callback] The function to customize cloning values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the deep cloned value.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * var deep = _.cloneDeep(characters);
     * deep[0] === characters[0];
     * // => false
     *
     * var view = {
     *   'label': 'docs',
     *   'node': element
     * };
     *
     * var clone = _.cloneDeep(view, function(value) {
     *   return _.isElement(value) ? value.cloneNode(true) : undefined;
     * });
     *
     * clone.node == view.node;
     * // => false
     */
    function cloneDeep(value, callback, thisArg) {
      return baseClone(value, true, typeof callback == 'function' && baseCreateCallback(callback, thisArg, 1));
    }

    /**
     * Creates an object that inherits from the given `prototype` object. If a
     * `properties` object is provided its own enumerable properties are assigned
     * to the created object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} prototype The object to inherit from.
     * @param {Object} [properties] The properties to assign to the object.
     * @returns {Object} Returns the new object.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * function Circle() {
     *   Shape.call(this);
     * }
     *
     * Circle.prototype = _.create(Shape.prototype, { 'constructor': Circle });
     *
     * var circle = new Circle;
     * circle instanceof Circle;
     * // => true
     *
     * circle instanceof Shape;
     * // => true
     */
    function create(prototype, properties) {
      var result = baseCreate(prototype);
      return properties ? assign(result, properties) : result;
    }

    /**
     * Assigns own enumerable properties of source object(s) to the destination
     * object for all destination properties that resolve to `undefined`. Once a
     * property is set, additional defaults of the same property will be ignored.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {Object} object The destination object.
     * @param {...Object} [source] The source objects.
     * @param- {Object} [guard] Allows working with `_.reduce` without using its
     *  `key` and `object` arguments as sources.
     * @returns {Object} Returns the destination object.
     * @example
     *
     * var object = { 'name': 'barney' };
     * _.defaults(object, { 'name': 'fred', 'employer': 'slate' });
     * // => { 'name': 'barney', 'employer': 'slate' }
     */
    var defaults = function(object, source, guard) {
      var index, iterable = object, result = iterable;
      if (!iterable) return result;
      var args = arguments,
          argsIndex = 0,
          argsLength = typeof guard == 'number' ? 2 : args.length;
      while (++argsIndex < argsLength) {
        iterable = args[argsIndex];
        if (iterable && objectTypes[typeof iterable]) {
        var ownIndex = -1,
            ownProps = objectTypes[typeof iterable] && keys(iterable),
            length = ownProps ? ownProps.length : 0;

        while (++ownIndex < length) {
          index = ownProps[ownIndex];
          if (typeof result[index] == 'undefined') result[index] = iterable[index];
        }
        }
      }
      return result
    };

    /**
     * This method is like `_.findIndex` except that it returns the key of the
     * first element that passes the callback check, instead of the element itself.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to search.
     * @param {Function|Object|string} [callback=identity] The function called per
     *  iteration. If a property name or object is provided it will be used to
     *  create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {string|undefined} Returns the key of the found element, else `undefined`.
     * @example
     *
     * var characters = {
     *   'barney': {  'age': 36, 'blocked': false },
     *   'fred': {    'age': 40, 'blocked': true },
     *   'pebbles': { 'age': 1,  'blocked': false }
     * };
     *
     * _.findKey(characters, function(chr) {
     *   return chr.age < 40;
     * });
     * // => 'barney' (property order is not guaranteed across environments)
     *
     * // using "_.where" callback shorthand
     * _.findKey(characters, { 'age': 1 });
     * // => 'pebbles'
     *
     * // using "_.pluck" callback shorthand
     * _.findKey(characters, 'blocked');
     * // => 'fred'
     */
    function findKey(object, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);
      forOwn(object, function(value, key, object) {
        if (callback(value, key, object)) {
          result = key;
          return false;
        }
      });
      return result;
    }

    /**
     * This method is like `_.findKey` except that it iterates over elements
     * of a `collection` in the opposite order.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to search.
     * @param {Function|Object|string} [callback=identity] The function called per
     *  iteration. If a property name or object is provided it will be used to
     *  create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {string|undefined} Returns the key of the found element, else `undefined`.
     * @example
     *
     * var characters = {
     *   'barney': {  'age': 36, 'blocked': true },
     *   'fred': {    'age': 40, 'blocked': false },
     *   'pebbles': { 'age': 1,  'blocked': true }
     * };
     *
     * _.findLastKey(characters, function(chr) {
     *   return chr.age < 40;
     * });
     * // => returns `pebbles`, assuming `_.findKey` returns `barney`
     *
     * // using "_.where" callback shorthand
     * _.findLastKey(characters, { 'age': 40 });
     * // => 'fred'
     *
     * // using "_.pluck" callback shorthand
     * _.findLastKey(characters, 'blocked');
     * // => 'pebbles'
     */
    function findLastKey(object, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);
      forOwnRight(object, function(value, key, object) {
        if (callback(value, key, object)) {
          result = key;
          return false;
        }
      });
      return result;
    }

    /**
     * Iterates over own and inherited enumerable properties of an object,
     * executing the callback for each property. The callback is bound to `thisArg`
     * and invoked with three arguments; (value, key, object). Callbacks may exit
     * iteration early by explicitly returning `false`.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * Shape.prototype.move = function(x, y) {
     *   this.x += x;
     *   this.y += y;
     * };
     *
     * _.forIn(new Shape, function(value, key) {
     *   console.log(key);
     * });
     * // => logs 'x', 'y', and 'move' (property order is not guaranteed across environments)
     */
    var forIn = function(collection, callback, thisArg) {
      var index, iterable = collection, result = iterable;
      if (!iterable) return result;
      if (!objectTypes[typeof iterable]) return result;
      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
        for (index in iterable) {
          if (callback(iterable[index], index, collection) === false) return result;
        }
      return result
    };

    /**
     * This method is like `_.forIn` except that it iterates over elements
     * of a `collection` in the opposite order.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * Shape.prototype.move = function(x, y) {
     *   this.x += x;
     *   this.y += y;
     * };
     *
     * _.forInRight(new Shape, function(value, key) {
     *   console.log(key);
     * });
     * // => logs 'move', 'y', and 'x' assuming `_.forIn ` logs 'x', 'y', and 'move'
     */
    function forInRight(object, callback, thisArg) {
      var pairs = [];

      forIn(object, function(value, key) {
        pairs.push(key, value);
      });

      var length = pairs.length;
      callback = baseCreateCallback(callback, thisArg, 3);
      while (length--) {
        if (callback(pairs[length--], pairs[length], object) === false) {
          break;
        }
      }
      return object;
    }

    /**
     * Iterates over own enumerable properties of an object, executing the callback
     * for each property. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, key, object). Callbacks may exit iteration early by
     * explicitly returning `false`.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * _.forOwn({ '0': 'zero', '1': 'one', 'length': 2 }, function(num, key) {
     *   console.log(key);
     * });
     * // => logs '0', '1', and 'length' (property order is not guaranteed across environments)
     */
    var forOwn = function(collection, callback, thisArg) {
      var index, iterable = collection, result = iterable;
      if (!iterable) return result;
      if (!objectTypes[typeof iterable]) return result;
      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
        var ownIndex = -1,
            ownProps = objectTypes[typeof iterable] && keys(iterable),
            length = ownProps ? ownProps.length : 0;

        while (++ownIndex < length) {
          index = ownProps[ownIndex];
          if (callback(iterable[index], index, collection) === false) return result;
        }
      return result
    };

    /**
     * This method is like `_.forOwn` except that it iterates over elements
     * of a `collection` in the opposite order.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * _.forOwnRight({ '0': 'zero', '1': 'one', 'length': 2 }, function(num, key) {
     *   console.log(key);
     * });
     * // => logs 'length', '1', and '0' assuming `_.forOwn` logs '0', '1', and 'length'
     */
    function forOwnRight(object, callback, thisArg) {
      var props = keys(object),
          length = props.length;

      callback = baseCreateCallback(callback, thisArg, 3);
      while (length--) {
        var key = props[length];
        if (callback(object[key], key, object) === false) {
          break;
        }
      }
      return object;
    }

    /**
     * Creates a sorted array of property names of all enumerable properties,
     * own and inherited, of `object` that have function values.
     *
     * @static
     * @memberOf _
     * @alias methods
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property names that have function values.
     * @example
     *
     * _.functions(_);
     * // => ['all', 'any', 'bind', 'bindAll', 'clone', 'compact', 'compose', ...]
     */
    function functions(object) {
      var result = [];
      forIn(object, function(value, key) {
        if (isFunction(value)) {
          result.push(key);
        }
      });
      return result.sort();
    }

    /**
     * Checks if the specified property name exists as a direct property of `object`,
     * instead of an inherited property.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @param {string} key The name of the property to check.
     * @returns {boolean} Returns `true` if key is a direct property, else `false`.
     * @example
     *
     * _.has({ 'a': 1, 'b': 2, 'c': 3 }, 'b');
     * // => true
     */
    function has(object, key) {
      return object ? hasOwnProperty.call(object, key) : false;
    }

    /**
     * Creates an object composed of the inverted keys and values of the given object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to invert.
     * @returns {Object} Returns the created inverted object.
     * @example
     *
     * _.invert({ 'first': 'fred', 'second': 'barney' });
     * // => { 'fred': 'first', 'barney': 'second' }
     */
    function invert(object) {
      var index = -1,
          props = keys(object),
          length = props.length,
          result = {};

      while (++index < length) {
        var key = props[index];
        result[object[key]] = key;
      }
      return result;
    }

    /**
     * Checks if `value` is a boolean value.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a boolean value, else `false`.
     * @example
     *
     * _.isBoolean(null);
     * // => false
     */
    function isBoolean(value) {
      return value === true || value === false ||
        value && typeof value == 'object' && toString.call(value) == boolClass || false;
    }

    /**
     * Checks if `value` is a date.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a date, else `false`.
     * @example
     *
     * _.isDate(new Date);
     * // => true
     */
    function isDate(value) {
      return value && typeof value == 'object' && toString.call(value) == dateClass || false;
    }

    /**
     * Checks if `value` is a DOM element.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a DOM element, else `false`.
     * @example
     *
     * _.isElement(document.body);
     * // => true
     */
    function isElement(value) {
      return value && value.nodeType === 1 || false;
    }

    /**
     * Checks if `value` is empty. Arrays, strings, or `arguments` objects with a
     * length of `0` and objects with no own enumerable properties are considered
     * "empty".
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Array|Object|string} value The value to inspect.
     * @returns {boolean} Returns `true` if the `value` is empty, else `false`.
     * @example
     *
     * _.isEmpty([1, 2, 3]);
     * // => false
     *
     * _.isEmpty({});
     * // => true
     *
     * _.isEmpty('');
     * // => true
     */
    function isEmpty(value) {
      var result = true;
      if (!value) {
        return result;
      }
      var className = toString.call(value),
          length = value.length;

      if ((className == arrayClass || className == stringClass || className == argsClass ) ||
          (className == objectClass && typeof length == 'number' && isFunction(value.splice))) {
        return !length;
      }
      forOwn(value, function() {
        return (result = false);
      });
      return result;
    }

    /**
     * Performs a deep comparison between two values to determine if they are
     * equivalent to each other. If a callback is provided it will be executed
     * to compare values. If the callback returns `undefined` comparisons will
     * be handled by the method instead. The callback is bound to `thisArg` and
     * invoked with two arguments; (a, b).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} a The value to compare.
     * @param {*} b The other value to compare.
     * @param {Function} [callback] The function to customize comparing values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
     * @example
     *
     * var object = { 'name': 'fred' };
     * var copy = { 'name': 'fred' };
     *
     * object == copy;
     * // => false
     *
     * _.isEqual(object, copy);
     * // => true
     *
     * var words = ['hello', 'goodbye'];
     * var otherWords = ['hi', 'goodbye'];
     *
     * _.isEqual(words, otherWords, function(a, b) {
     *   var reGreet = /^(?:hello|hi)$/i,
     *       aGreet = _.isString(a) && reGreet.test(a),
     *       bGreet = _.isString(b) && reGreet.test(b);
     *
     *   return (aGreet || bGreet) ? (aGreet == bGreet) : undefined;
     * });
     * // => true
     */
    function isEqual(a, b, callback, thisArg) {
      return baseIsEqual(a, b, typeof callback == 'function' && baseCreateCallback(callback, thisArg, 2));
    }

    /**
     * Checks if `value` is, or can be coerced to, a finite number.
     *
     * Note: This is not the same as native `isFinite` which will return true for
     * booleans and empty strings. See http://es5.github.io/#x15.1.2.5.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is finite, else `false`.
     * @example
     *
     * _.isFinite(-101);
     * // => true
     *
     * _.isFinite('10');
     * // => true
     *
     * _.isFinite(true);
     * // => false
     *
     * _.isFinite('');
     * // => false
     *
     * _.isFinite(Infinity);
     * // => false
     */
    function isFinite(value) {
      return nativeIsFinite(value) && !nativeIsNaN(parseFloat(value));
    }

    /**
     * Checks if `value` is a function.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a function, else `false`.
     * @example
     *
     * _.isFunction(_);
     * // => true
     */
    function isFunction(value) {
      return typeof value == 'function';
    }

    /**
     * Checks if `value` is the language type of Object.
     * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is an object, else `false`.
     * @example
     *
     * _.isObject({});
     * // => true
     *
     * _.isObject([1, 2, 3]);
     * // => true
     *
     * _.isObject(1);
     * // => false
     */
    function isObject(value) {
      // check if the value is the ECMAScript language type of Object
      // http://es5.github.io/#x8
      // and avoid a V8 bug
      // http://code.google.com/p/v8/issues/detail?id=2291
      return !!(value && objectTypes[typeof value]);
    }

    /**
     * Checks if `value` is `NaN`.
     *
     * Note: This is not the same as native `isNaN` which will return `true` for
     * `undefined` and other non-numeric values. See http://es5.github.io/#x15.1.2.4.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is `NaN`, else `false`.
     * @example
     *
     * _.isNaN(NaN);
     * // => true
     *
     * _.isNaN(new Number(NaN));
     * // => true
     *
     * isNaN(undefined);
     * // => true
     *
     * _.isNaN(undefined);
     * // => false
     */
    function isNaN(value) {
      // `NaN` as a primitive is the only value that is not equal to itself
      // (perform the [[Class]] check first to avoid errors with some host objects in IE)
      return isNumber(value) && value != +value;
    }

    /**
     * Checks if `value` is `null`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is `null`, else `false`.
     * @example
     *
     * _.isNull(null);
     * // => true
     *
     * _.isNull(undefined);
     * // => false
     */
    function isNull(value) {
      return value === null;
    }

    /**
     * Checks if `value` is a number.
     *
     * Note: `NaN` is considered a number. See http://es5.github.io/#x8.5.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a number, else `false`.
     * @example
     *
     * _.isNumber(8.4 * 5);
     * // => true
     */
    function isNumber(value) {
      return typeof value == 'number' ||
        value && typeof value == 'object' && toString.call(value) == numberClass || false;
    }

    /**
     * Checks if `value` is an object created by the `Object` constructor.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * _.isPlainObject(new Shape);
     * // => false
     *
     * _.isPlainObject([1, 2, 3]);
     * // => false
     *
     * _.isPlainObject({ 'x': 0, 'y': 0 });
     * // => true
     */
    var isPlainObject = !getPrototypeOf ? shimIsPlainObject : function(value) {
      if (!(value && toString.call(value) == objectClass)) {
        return false;
      }
      var valueOf = value.valueOf,
          objProto = isNative(valueOf) && (objProto = getPrototypeOf(valueOf)) && getPrototypeOf(objProto);

      return objProto
        ? (value == objProto || getPrototypeOf(value) == objProto)
        : shimIsPlainObject(value);
    };

    /**
     * Checks if `value` is a regular expression.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a regular expression, else `false`.
     * @example
     *
     * _.isRegExp(/fred/);
     * // => true
     */
    function isRegExp(value) {
      return value && typeof value == 'object' && toString.call(value) == regexpClass || false;
    }

    /**
     * Checks if `value` is a string.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a string, else `false`.
     * @example
     *
     * _.isString('fred');
     * // => true
     */
    function isString(value) {
      return typeof value == 'string' ||
        value && typeof value == 'object' && toString.call(value) == stringClass || false;
    }

    /**
     * Checks if `value` is `undefined`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is `undefined`, else `false`.
     * @example
     *
     * _.isUndefined(void 0);
     * // => true
     */
    function isUndefined(value) {
      return typeof value == 'undefined';
    }

    /**
     * Creates an object with the same keys as `object` and values generated by
     * running each own enumerable property of `object` through the callback.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, key, object).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new object with values of the results of each `callback` execution.
     * @example
     *
     * _.mapValues({ 'a': 1, 'b': 2, 'c': 3} , function(num) { return num * 3; });
     * // => { 'a': 3, 'b': 6, 'c': 9 }
     *
     * var characters = {
     *   'fred': { 'name': 'fred', 'age': 40 },
     *   'pebbles': { 'name': 'pebbles', 'age': 1 }
     * };
     *
     * // using "_.pluck" callback shorthand
     * _.mapValues(characters, 'age');
     * // => { 'fred': 40, 'pebbles': 1 }
     */
    function mapValues(object, callback, thisArg) {
      var result = {};
      callback = lodash.createCallback(callback, thisArg, 3);

      forOwn(object, function(value, key, object) {
        result[key] = callback(value, key, object);
      });
      return result;
    }

    /**
     * Recursively merges own enumerable properties of the source object(s), that
     * don't resolve to `undefined` into the destination object. Subsequent sources
     * will overwrite property assignments of previous sources. If a callback is
     * provided it will be executed to produce the merged values of the destination
     * and source properties. If the callback returns `undefined` merging will
     * be handled by the method instead. The callback is bound to `thisArg` and
     * invoked with two arguments; (objectValue, sourceValue).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The destination object.
     * @param {...Object} [source] The source objects.
     * @param {Function} [callback] The function to customize merging properties.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the destination object.
     * @example
     *
     * var names = {
     *   'characters': [
     *     { 'name': 'barney' },
     *     { 'name': 'fred' }
     *   ]
     * };
     *
     * var ages = {
     *   'characters': [
     *     { 'age': 36 },
     *     { 'age': 40 }
     *   ]
     * };
     *
     * _.merge(names, ages);
     * // => { 'characters': [{ 'name': 'barney', 'age': 36 }, { 'name': 'fred', 'age': 40 }] }
     *
     * var food = {
     *   'fruits': ['apple'],
     *   'vegetables': ['beet']
     * };
     *
     * var otherFood = {
     *   'fruits': ['banana'],
     *   'vegetables': ['carrot']
     * };
     *
     * _.merge(food, otherFood, function(a, b) {
     *   return _.isArray(a) ? a.concat(b) : undefined;
     * });
     * // => { 'fruits': ['apple', 'banana'], 'vegetables': ['beet', 'carrot] }
     */
    function merge(object) {
      var args = arguments,
          length = 2;

      if (!isObject(object)) {
        return object;
      }
      // allows working with `_.reduce` and `_.reduceRight` without using
      // their `index` and `collection` arguments
      if (typeof args[2] != 'number') {
        length = args.length;
      }
      if (length > 3 && typeof args[length - 2] == 'function') {
        var callback = baseCreateCallback(args[--length - 1], args[length--], 2);
      } else if (length > 2 && typeof args[length - 1] == 'function') {
        callback = args[--length];
      }
      var sources = slice(arguments, 1, length),
          index = -1,
          stackA = getArray(),
          stackB = getArray();

      while (++index < length) {
        baseMerge(object, sources[index], callback, stackA, stackB);
      }
      releaseArray(stackA);
      releaseArray(stackB);
      return object;
    }

    /**
     * Creates a shallow clone of `object` excluding the specified properties.
     * Property names may be specified as individual arguments or as arrays of
     * property names. If a callback is provided it will be executed for each
     * property of `object` omitting the properties the callback returns truey
     * for. The callback is bound to `thisArg` and invoked with three arguments;
     * (value, key, object).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The source object.
     * @param {Function|...string|string[]} [callback] The properties to omit or the
     *  function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns an object without the omitted properties.
     * @example
     *
     * _.omit({ 'name': 'fred', 'age': 40 }, 'age');
     * // => { 'name': 'fred' }
     *
     * _.omit({ 'name': 'fred', 'age': 40 }, function(value) {
     *   return typeof value == 'number';
     * });
     * // => { 'name': 'fred' }
     */
    function omit(object, callback, thisArg) {
      var result = {};
      if (typeof callback != 'function') {
        var props = [];
        forIn(object, function(value, key) {
          props.push(key);
        });
        props = baseDifference(props, baseFlatten(arguments, true, false, 1));

        var index = -1,
            length = props.length;

        while (++index < length) {
          var key = props[index];
          result[key] = object[key];
        }
      } else {
        callback = lodash.createCallback(callback, thisArg, 3);
        forIn(object, function(value, key, object) {
          if (!callback(value, key, object)) {
            result[key] = value;
          }
        });
      }
      return result;
    }

    /**
     * Creates a two dimensional array of an object's key-value pairs,
     * i.e. `[[key1, value1], [key2, value2]]`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns new array of key-value pairs.
     * @example
     *
     * _.pairs({ 'barney': 36, 'fred': 40 });
     * // => [['barney', 36], ['fred', 40]] (property order is not guaranteed across environments)
     */
    function pairs(object) {
      var index = -1,
          props = keys(object),
          length = props.length,
          result = Array(length);

      while (++index < length) {
        var key = props[index];
        result[index] = [key, object[key]];
      }
      return result;
    }

    /**
     * Creates a shallow clone of `object` composed of the specified properties.
     * Property names may be specified as individual arguments or as arrays of
     * property names. If a callback is provided it will be executed for each
     * property of `object` picking the properties the callback returns truey
     * for. The callback is bound to `thisArg` and invoked with three arguments;
     * (value, key, object).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The source object.
     * @param {Function|...string|string[]} [callback] The function called per
     *  iteration or property names to pick, specified as individual property
     *  names or arrays of property names.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns an object composed of the picked properties.
     * @example
     *
     * _.pick({ 'name': 'fred', '_userid': 'fred1' }, 'name');
     * // => { 'name': 'fred' }
     *
     * _.pick({ 'name': 'fred', '_userid': 'fred1' }, function(value, key) {
     *   return key.charAt(0) != '_';
     * });
     * // => { 'name': 'fred' }
     */
    function pick(object, callback, thisArg) {
      var result = {};
      if (typeof callback != 'function') {
        var index = -1,
            props = baseFlatten(arguments, true, false, 1),
            length = isObject(object) ? props.length : 0;

        while (++index < length) {
          var key = props[index];
          if (key in object) {
            result[key] = object[key];
          }
        }
      } else {
        callback = lodash.createCallback(callback, thisArg, 3);
        forIn(object, function(value, key, object) {
          if (callback(value, key, object)) {
            result[key] = value;
          }
        });
      }
      return result;
    }

    /**
     * An alternative to `_.reduce` this method transforms `object` to a new
     * `accumulator` object which is the result of running each of its own
     * enumerable properties through a callback, with each callback execution
     * potentially mutating the `accumulator` object. The callback is bound to
     * `thisArg` and invoked with four arguments; (accumulator, value, key, object).
     * Callbacks may exit iteration early by explicitly returning `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Array|Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [accumulator] The custom accumulator value.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the accumulated value.
     * @example
     *
     * var squares = _.transform([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], function(result, num) {
     *   num *= num;
     *   if (num % 2) {
     *     return result.push(num) < 3;
     *   }
     * });
     * // => [1, 9, 25]
     *
     * var mapped = _.transform({ 'a': 1, 'b': 2, 'c': 3 }, function(result, num, key) {
     *   result[key] = num * 3;
     * });
     * // => { 'a': 3, 'b': 6, 'c': 9 }
     */
    function transform(object, callback, accumulator, thisArg) {
      var isArr = isArray(object);
      if (accumulator == null) {
        if (isArr) {
          accumulator = [];
        } else {
          var ctor = object && object.constructor,
              proto = ctor && ctor.prototype;

          accumulator = baseCreate(proto);
        }
      }
      if (callback) {
        callback = lodash.createCallback(callback, thisArg, 4);
        (isArr ? forEach : forOwn)(object, function(value, index, object) {
          return callback(accumulator, value, index, object);
        });
      }
      return accumulator;
    }

    /**
     * Creates an array composed of the own enumerable property values of `object`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property values.
     * @example
     *
     * _.values({ 'one': 1, 'two': 2, 'three': 3 });
     * // => [1, 2, 3] (property order is not guaranteed across environments)
     */
    function values(object) {
      var index = -1,
          props = keys(object),
          length = props.length,
          result = Array(length);

      while (++index < length) {
        result[index] = object[props[index]];
      }
      return result;
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates an array of elements from the specified indexes, or keys, of the
     * `collection`. Indexes may be specified as individual arguments or as arrays
     * of indexes.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {...(number|number[]|string|string[])} [index] The indexes of `collection`
     *   to retrieve, specified as individual indexes or arrays of indexes.
     * @returns {Array} Returns a new array of elements corresponding to the
     *  provided indexes.
     * @example
     *
     * _.at(['a', 'b', 'c', 'd', 'e'], [0, 2, 4]);
     * // => ['a', 'c', 'e']
     *
     * _.at(['fred', 'barney', 'pebbles'], 0, 2);
     * // => ['fred', 'pebbles']
     */
    function at(collection) {
      var args = arguments,
          index = -1,
          props = baseFlatten(args, true, false, 1),
          length = (args[2] && args[2][args[1]] === collection) ? 1 : props.length,
          result = Array(length);

      while(++index < length) {
        result[index] = collection[props[index]];
      }
      return result;
    }

    /**
     * Checks if a given value is present in a collection using strict equality
     * for comparisons, i.e. `===`. If `fromIndex` is negative, it is used as the
     * offset from the end of the collection.
     *
     * @static
     * @memberOf _
     * @alias include
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {*} target The value to check for.
     * @param {number} [fromIndex=0] The index to search from.
     * @returns {boolean} Returns `true` if the `target` element is found, else `false`.
     * @example
     *
     * _.contains([1, 2, 3], 1);
     * // => true
     *
     * _.contains([1, 2, 3], 1, 2);
     * // => false
     *
     * _.contains({ 'name': 'fred', 'age': 40 }, 'fred');
     * // => true
     *
     * _.contains('pebbles', 'eb');
     * // => true
     */
    function contains(collection, target, fromIndex) {
      var index = -1,
          indexOf = getIndexOf(),
          length = collection ? collection.length : 0,
          result = false;

      fromIndex = (fromIndex < 0 ? nativeMax(0, length + fromIndex) : fromIndex) || 0;
      if (isArray(collection)) {
        result = indexOf(collection, target, fromIndex) > -1;
      } else if (typeof length == 'number') {
        result = (isString(collection) ? collection.indexOf(target, fromIndex) : indexOf(collection, target, fromIndex)) > -1;
      } else {
        forOwn(collection, function(value) {
          if (++index >= fromIndex) {
            return !(result = value === target);
          }
        });
      }
      return result;
    }

    /**
     * Creates an object composed of keys generated from the results of running
     * each element of `collection` through the callback. The corresponding value
     * of each key is the number of times the key was returned by the callback.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the composed aggregate object.
     * @example
     *
     * _.countBy([4.3, 6.1, 6.4], function(num) { return Math.floor(num); });
     * // => { '4': 1, '6': 2 }
     *
     * _.countBy([4.3, 6.1, 6.4], function(num) { return this.floor(num); }, Math);
     * // => { '4': 1, '6': 2 }
     *
     * _.countBy(['one', 'two', 'three'], 'length');
     * // => { '3': 2, '5': 1 }
     */
    var countBy = createAggregator(function(result, value, key) {
      (hasOwnProperty.call(result, key) ? result[key]++ : result[key] = 1);
    });

    /**
     * Checks if the given callback returns truey value for **all** elements of
     * a collection. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias all
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {boolean} Returns `true` if all elements passed the callback check,
     *  else `false`.
     * @example
     *
     * _.every([true, 1, null, 'yes']);
     * // => false
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.every(characters, 'age');
     * // => true
     *
     * // using "_.where" callback shorthand
     * _.every(characters, { 'age': 36 });
     * // => false
     */
    function every(collection, callback, thisArg) {
      var result = true;
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          if (!(result = !!callback(collection[index], index, collection))) {
            break;
          }
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          return (result = !!callback(value, index, collection));
        });
      }
      return result;
    }

    /**
     * Iterates over elements of a collection, returning an array of all elements
     * the callback returns truey for. The callback is bound to `thisArg` and
     * invoked with three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias select
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of elements that passed the callback check.
     * @example
     *
     * var evens = _.filter([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
     * // => [2, 4, 6]
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'blocked': false },
     *   { 'name': 'fred',   'age': 40, 'blocked': true }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.filter(characters, 'blocked');
     * // => [{ 'name': 'fred', 'age': 40, 'blocked': true }]
     *
     * // using "_.where" callback shorthand
     * _.filter(characters, { 'age': 36 });
     * // => [{ 'name': 'barney', 'age': 36, 'blocked': false }]
     */
    function filter(collection, callback, thisArg) {
      var result = [];
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          var value = collection[index];
          if (callback(value, index, collection)) {
            result.push(value);
          }
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          if (callback(value, index, collection)) {
            result.push(value);
          }
        });
      }
      return result;
    }

    /**
     * Iterates over elements of a collection, returning the first element that
     * the callback returns truey for. The callback is bound to `thisArg` and
     * invoked with three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias detect, findWhere
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the found element, else `undefined`.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36, 'blocked': false },
     *   { 'name': 'fred',    'age': 40, 'blocked': true },
     *   { 'name': 'pebbles', 'age': 1,  'blocked': false }
     * ];
     *
     * _.find(characters, function(chr) {
     *   return chr.age < 40;
     * });
     * // => { 'name': 'barney', 'age': 36, 'blocked': false }
     *
     * // using "_.where" callback shorthand
     * _.find(characters, { 'age': 1 });
     * // =>  { 'name': 'pebbles', 'age': 1, 'blocked': false }
     *
     * // using "_.pluck" callback shorthand
     * _.find(characters, 'blocked');
     * // => { 'name': 'fred', 'age': 40, 'blocked': true }
     */
    function find(collection, callback, thisArg) {
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          var value = collection[index];
          if (callback(value, index, collection)) {
            return value;
          }
        }
      } else {
        var result;
        forOwn(collection, function(value, index, collection) {
          if (callback(value, index, collection)) {
            result = value;
            return false;
          }
        });
        return result;
      }
    }

    /**
     * This method is like `_.find` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the found element, else `undefined`.
     * @example
     *
     * _.findLast([1, 2, 3, 4], function(num) {
     *   return num % 2 == 1;
     * });
     * // => 3
     */
    function findLast(collection, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);
      forEachRight(collection, function(value, index, collection) {
        if (callback(value, index, collection)) {
          result = value;
          return false;
        }
      });
      return result;
    }

    /**
     * Iterates over elements of a collection, executing the callback for each
     * element. The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection). Callbacks may exit iteration early by
     * explicitly returning `false`.
     *
     * Note: As with other "Collections" methods, objects with a `length` property
     * are iterated like arrays. To avoid this behavior `_.forIn` or `_.forOwn`
     * may be used for object iteration.
     *
     * @static
     * @memberOf _
     * @alias each
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array|Object|string} Returns `collection`.
     * @example
     *
     * _([1, 2, 3]).forEach(function(num) { console.log(num); }).join(',');
     * // => logs each number and returns '1,2,3'
     *
     * _.forEach({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { console.log(num); });
     * // => logs each number and returns the object (property order is not guaranteed across environments)
     */
    function forEach(collection, callback, thisArg) {
      var index = -1,
          length = collection ? collection.length : 0;

      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
      if (typeof length == 'number') {
        while (++index < length) {
          if (callback(collection[index], index, collection) === false) {
            break;
          }
        }
      } else {
        forOwn(collection, callback);
      }
      return collection;
    }

    /**
     * This method is like `_.forEach` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * @static
     * @memberOf _
     * @alias eachRight
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array|Object|string} Returns `collection`.
     * @example
     *
     * _([1, 2, 3]).forEachRight(function(num) { console.log(num); }).join(',');
     * // => logs each number from right to left and returns '3,2,1'
     */
    function forEachRight(collection, callback, thisArg) {
      var length = collection ? collection.length : 0;
      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
      if (typeof length == 'number') {
        while (length--) {
          if (callback(collection[length], length, collection) === false) {
            break;
          }
        }
      } else {
        var props = keys(collection);
        length = props.length;
        forOwn(collection, function(value, key, collection) {
          key = props ? props[--length] : --length;
          return callback(collection[key], key, collection);
        });
      }
      return collection;
    }

    /**
     * Creates an object composed of keys generated from the results of running
     * each element of a collection through the callback. The corresponding value
     * of each key is an array of the elements responsible for generating the key.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the composed aggregate object.
     * @example
     *
     * _.groupBy([4.2, 6.1, 6.4], function(num) { return Math.floor(num); });
     * // => { '4': [4.2], '6': [6.1, 6.4] }
     *
     * _.groupBy([4.2, 6.1, 6.4], function(num) { return this.floor(num); }, Math);
     * // => { '4': [4.2], '6': [6.1, 6.4] }
     *
     * // using "_.pluck" callback shorthand
     * _.groupBy(['one', 'two', 'three'], 'length');
     * // => { '3': ['one', 'two'], '5': ['three'] }
     */
    var groupBy = createAggregator(function(result, value, key) {
      (hasOwnProperty.call(result, key) ? result[key] : result[key] = []).push(value);
    });

    /**
     * Creates an object composed of keys generated from the results of running
     * each element of the collection through the given callback. The corresponding
     * value of each key is the last element responsible for generating the key.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the composed aggregate object.
     * @example
     *
     * var keys = [
     *   { 'dir': 'left', 'code': 97 },
     *   { 'dir': 'right', 'code': 100 }
     * ];
     *
     * _.indexBy(keys, 'dir');
     * // => { 'left': { 'dir': 'left', 'code': 97 }, 'right': { 'dir': 'right', 'code': 100 } }
     *
     * _.indexBy(keys, function(key) { return String.fromCharCode(key.code); });
     * // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
     *
     * _.indexBy(characters, function(key) { this.fromCharCode(key.code); }, String);
     * // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
     */
    var indexBy = createAggregator(function(result, value, key) {
      result[key] = value;
    });

    /**
     * Invokes the method named by `methodName` on each element in the `collection`
     * returning an array of the results of each invoked method. Additional arguments
     * will be provided to each invoked method. If `methodName` is a function it
     * will be invoked for, and `this` bound to, each element in the `collection`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|string} methodName The name of the method to invoke or
     *  the function invoked per iteration.
     * @param {...*} [arg] Arguments to invoke the method with.
     * @returns {Array} Returns a new array of the results of each invoked method.
     * @example
     *
     * _.invoke([[5, 1, 7], [3, 2, 1]], 'sort');
     * // => [[1, 5, 7], [1, 2, 3]]
     *
     * _.invoke([123, 456], String.prototype.split, '');
     * // => [['1', '2', '3'], ['4', '5', '6']]
     */
    function invoke(collection, methodName) {
      var args = slice(arguments, 2),
          index = -1,
          isFunc = typeof methodName == 'function',
          length = collection ? collection.length : 0,
          result = Array(typeof length == 'number' ? length : 0);

      forEach(collection, function(value) {
        result[++index] = (isFunc ? methodName : value[methodName]).apply(value, args);
      });
      return result;
    }

    /**
     * Creates an array of values by running each element in the collection
     * through the callback. The callback is bound to `thisArg` and invoked with
     * three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias collect
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of the results of each `callback` execution.
     * @example
     *
     * _.map([1, 2, 3], function(num) { return num * 3; });
     * // => [3, 6, 9]
     *
     * _.map({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { return num * 3; });
     * // => [3, 6, 9] (property order is not guaranteed across environments)
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.map(characters, 'name');
     * // => ['barney', 'fred']
     */
    function map(collection, callback, thisArg) {
      var index = -1,
          length = collection ? collection.length : 0;

      callback = lodash.createCallback(callback, thisArg, 3);
      if (typeof length == 'number') {
        var result = Array(length);
        while (++index < length) {
          result[index] = callback(collection[index], index, collection);
        }
      } else {
        result = [];
        forOwn(collection, function(value, key, collection) {
          result[++index] = callback(value, key, collection);
        });
      }
      return result;
    }

    /**
     * Retrieves the maximum value of a collection. If the collection is empty or
     * falsey `-Infinity` is returned. If a callback is provided it will be executed
     * for each value in the collection to generate the criterion by which the value
     * is ranked. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the maximum value.
     * @example
     *
     * _.max([4, 2, 8, 6]);
     * // => 8
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * _.max(characters, function(chr) { return chr.age; });
     * // => { 'name': 'fred', 'age': 40 };
     *
     * // using "_.pluck" callback shorthand
     * _.max(characters, 'age');
     * // => { 'name': 'fred', 'age': 40 };
     */
    function max(collection, callback, thisArg) {
      var computed = -Infinity,
          result = computed;

      // allows working with functions like `_.map` without using
      // their `index` argument as a callback
      if (typeof callback != 'function' && thisArg && thisArg[callback] === collection) {
        callback = null;
      }
      if (callback == null && isArray(collection)) {
        var index = -1,
            length = collection.length;

        while (++index < length) {
          var value = collection[index];
          if (value > result) {
            result = value;
          }
        }
      } else {
        callback = (callback == null && isString(collection))
          ? charAtCallback
          : lodash.createCallback(callback, thisArg, 3);

        forEach(collection, function(value, index, collection) {
          var current = callback(value, index, collection);
          if (current > computed) {
            computed = current;
            result = value;
          }
        });
      }
      return result;
    }

    /**
     * Retrieves the minimum value of a collection. If the collection is empty or
     * falsey `Infinity` is returned. If a callback is provided it will be executed
     * for each value in the collection to generate the criterion by which the value
     * is ranked. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the minimum value.
     * @example
     *
     * _.min([4, 2, 8, 6]);
     * // => 2
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * _.min(characters, function(chr) { return chr.age; });
     * // => { 'name': 'barney', 'age': 36 };
     *
     * // using "_.pluck" callback shorthand
     * _.min(characters, 'age');
     * // => { 'name': 'barney', 'age': 36 };
     */
    function min(collection, callback, thisArg) {
      var computed = Infinity,
          result = computed;

      // allows working with functions like `_.map` without using
      // their `index` argument as a callback
      if (typeof callback != 'function' && thisArg && thisArg[callback] === collection) {
        callback = null;
      }
      if (callback == null && isArray(collection)) {
        var index = -1,
            length = collection.length;

        while (++index < length) {
          var value = collection[index];
          if (value < result) {
            result = value;
          }
        }
      } else {
        callback = (callback == null && isString(collection))
          ? charAtCallback
          : lodash.createCallback(callback, thisArg, 3);

        forEach(collection, function(value, index, collection) {
          var current = callback(value, index, collection);
          if (current < computed) {
            computed = current;
            result = value;
          }
        });
      }
      return result;
    }

    /**
     * Retrieves the value of a specified property from all elements in the collection.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {string} property The name of the property to pluck.
     * @returns {Array} Returns a new array of property values.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * _.pluck(characters, 'name');
     * // => ['barney', 'fred']
     */
    var pluck = map;

    /**
     * Reduces a collection to a value which is the accumulated result of running
     * each element in the collection through the callback, where each successive
     * callback execution consumes the return value of the previous execution. If
     * `accumulator` is not provided the first element of the collection will be
     * used as the initial `accumulator` value. The callback is bound to `thisArg`
     * and invoked with four arguments; (accumulator, value, index|key, collection).
     *
     * @static
     * @memberOf _
     * @alias foldl, inject
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [accumulator] Initial value of the accumulator.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the accumulated value.
     * @example
     *
     * var sum = _.reduce([1, 2, 3], function(sum, num) {
     *   return sum + num;
     * });
     * // => 6
     *
     * var mapped = _.reduce({ 'a': 1, 'b': 2, 'c': 3 }, function(result, num, key) {
     *   result[key] = num * 3;
     *   return result;
     * }, {});
     * // => { 'a': 3, 'b': 6, 'c': 9 }
     */
    function reduce(collection, callback, accumulator, thisArg) {
      if (!collection) return accumulator;
      var noaccum = arguments.length < 3;
      callback = lodash.createCallback(callback, thisArg, 4);

      var index = -1,
          length = collection.length;

      if (typeof length == 'number') {
        if (noaccum) {
          accumulator = collection[++index];
        }
        while (++index < length) {
          accumulator = callback(accumulator, collection[index], index, collection);
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          accumulator = noaccum
            ? (noaccum = false, value)
            : callback(accumulator, value, index, collection)
        });
      }
      return accumulator;
    }

    /**
     * This method is like `_.reduce` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * @static
     * @memberOf _
     * @alias foldr
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [accumulator] Initial value of the accumulator.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the accumulated value.
     * @example
     *
     * var list = [[0, 1], [2, 3], [4, 5]];
     * var flat = _.reduceRight(list, function(a, b) { return a.concat(b); }, []);
     * // => [4, 5, 2, 3, 0, 1]
     */
    function reduceRight(collection, callback, accumulator, thisArg) {
      var noaccum = arguments.length < 3;
      callback = lodash.createCallback(callback, thisArg, 4);
      forEachRight(collection, function(value, index, collection) {
        accumulator = noaccum
          ? (noaccum = false, value)
          : callback(accumulator, value, index, collection);
      });
      return accumulator;
    }

    /**
     * The opposite of `_.filter` this method returns the elements of a
     * collection that the callback does **not** return truey for.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of elements that failed the callback check.
     * @example
     *
     * var odds = _.reject([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
     * // => [1, 3, 5]
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'blocked': false },
     *   { 'name': 'fred',   'age': 40, 'blocked': true }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.reject(characters, 'blocked');
     * // => [{ 'name': 'barney', 'age': 36, 'blocked': false }]
     *
     * // using "_.where" callback shorthand
     * _.reject(characters, { 'age': 36 });
     * // => [{ 'name': 'fred', 'age': 40, 'blocked': true }]
     */
    function reject(collection, callback, thisArg) {
      callback = lodash.createCallback(callback, thisArg, 3);
      return filter(collection, function(value, index, collection) {
        return !callback(value, index, collection);
      });
    }

    /**
     * Retrieves a random element or `n` random elements from a collection.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to sample.
     * @param {number} [n] The number of elements to sample.
     * @param- {Object} [guard] Allows working with functions like `_.map`
     *  without using their `index` arguments as `n`.
     * @returns {Array} Returns the random sample(s) of `collection`.
     * @example
     *
     * _.sample([1, 2, 3, 4]);
     * // => 2
     *
     * _.sample([1, 2, 3, 4], 2);
     * // => [3, 1]
     */
    function sample(collection, n, guard) {
      if (collection && typeof collection.length != 'number') {
        collection = values(collection);
      }
      if (n == null || guard) {
        return collection ? collection[baseRandom(0, collection.length - 1)] : undefined;
      }
      var result = shuffle(collection);
      result.length = nativeMin(nativeMax(0, n), result.length);
      return result;
    }

    /**
     * Creates an array of shuffled values, using a version of the Fisher-Yates
     * shuffle. See http://en.wikipedia.org/wiki/Fisher-Yates_shuffle.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to shuffle.
     * @returns {Array} Returns a new shuffled collection.
     * @example
     *
     * _.shuffle([1, 2, 3, 4, 5, 6]);
     * // => [4, 1, 6, 3, 5, 2]
     */
    function shuffle(collection) {
      var index = -1,
          length = collection ? collection.length : 0,
          result = Array(typeof length == 'number' ? length : 0);

      forEach(collection, function(value) {
        var rand = baseRandom(0, ++index);
        result[index] = result[rand];
        result[rand] = value;
      });
      return result;
    }

    /**
     * Gets the size of the `collection` by returning `collection.length` for arrays
     * and array-like objects or the number of own enumerable properties for objects.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to inspect.
     * @returns {number} Returns `collection.length` or number of own enumerable properties.
     * @example
     *
     * _.size([1, 2]);
     * // => 2
     *
     * _.size({ 'one': 1, 'two': 2, 'three': 3 });
     * // => 3
     *
     * _.size('pebbles');
     * // => 7
     */
    function size(collection) {
      var length = collection ? collection.length : 0;
      return typeof length == 'number' ? length : keys(collection).length;
    }

    /**
     * Checks if the callback returns a truey value for **any** element of a
     * collection. The function returns as soon as it finds a passing value and
     * does not iterate over the entire collection. The callback is bound to
     * `thisArg` and invoked with three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias any
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {boolean} Returns `true` if any element passed the callback check,
     *  else `false`.
     * @example
     *
     * _.some([null, 0, 'yes', false], Boolean);
     * // => true
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'blocked': false },
     *   { 'name': 'fred',   'age': 40, 'blocked': true }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.some(characters, 'blocked');
     * // => true
     *
     * // using "_.where" callback shorthand
     * _.some(characters, { 'age': 1 });
     * // => false
     */
    function some(collection, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          if ((result = callback(collection[index], index, collection))) {
            break;
          }
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          return !(result = callback(value, index, collection));
        });
      }
      return !!result;
    }

    /**
     * Creates an array of elements, sorted in ascending order by the results of
     * running each element in a collection through the callback. This method
     * performs a stable sort, that is, it will preserve the original sort order
     * of equal elements. The callback is bound to `thisArg` and invoked with
     * three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an array of property names is provided for `callback` the collection
     * will be sorted by each property value.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Array|Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of sorted elements.
     * @example
     *
     * _.sortBy([1, 2, 3], function(num) { return Math.sin(num); });
     * // => [3, 1, 2]
     *
     * _.sortBy([1, 2, 3], function(num) { return this.sin(num); }, Math);
     * // => [3, 1, 2]
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36 },
     *   { 'name': 'fred',    'age': 40 },
     *   { 'name': 'barney',  'age': 26 },
     *   { 'name': 'fred',    'age': 30 }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.map(_.sortBy(characters, 'age'), _.values);
     * // => [['barney', 26], ['fred', 30], ['barney', 36], ['fred', 40]]
     *
     * // sorting by multiple properties
     * _.map(_.sortBy(characters, ['name', 'age']), _.values);
     * // = > [['barney', 26], ['barney', 36], ['fred', 30], ['fred', 40]]
     */
    function sortBy(collection, callback, thisArg) {
      var index = -1,
          isArr = isArray(callback),
          length = collection ? collection.length : 0,
          result = Array(typeof length == 'number' ? length : 0);

      if (!isArr) {
        callback = lodash.createCallback(callback, thisArg, 3);
      }
      forEach(collection, function(value, key, collection) {
        var object = result[++index] = getObject();
        if (isArr) {
          object.criteria = map(callback, function(key) { return value[key]; });
        } else {
          (object.criteria = getArray())[0] = callback(value, key, collection);
        }
        object.index = index;
        object.value = value;
      });

      length = result.length;
      result.sort(compareAscending);
      while (length--) {
        var object = result[length];
        result[length] = object.value;
        if (!isArr) {
          releaseArray(object.criteria);
        }
        releaseObject(object);
      }
      return result;
    }

    /**
     * Converts the `collection` to an array.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to convert.
     * @returns {Array} Returns the new converted array.
     * @example
     *
     * (function() { return _.toArray(arguments).slice(1); })(1, 2, 3, 4);
     * // => [2, 3, 4]
     */
    function toArray(collection) {
      if (collection && typeof collection.length == 'number') {
        return slice(collection);
      }
      return values(collection);
    }

    /**
     * Performs a deep comparison of each element in a `collection` to the given
     * `properties` object, returning an array of all elements that have equivalent
     * property values.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Object} props The object of property values to filter by.
     * @returns {Array} Returns a new array of elements that have the given properties.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'pets': ['hoppy'] },
     *   { 'name': 'fred',   'age': 40, 'pets': ['baby puss', 'dino'] }
     * ];
     *
     * _.where(characters, { 'age': 36 });
     * // => [{ 'name': 'barney', 'age': 36, 'pets': ['hoppy'] }]
     *
     * _.where(characters, { 'pets': ['dino'] });
     * // => [{ 'name': 'fred', 'age': 40, 'pets': ['baby puss', 'dino'] }]
     */
    var where = filter;

    /*--------------------------------------------------------------------------*/

    /**
     * Creates an array with all falsey values removed. The values `false`, `null`,
     * `0`, `""`, `undefined`, and `NaN` are all falsey.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to compact.
     * @returns {Array} Returns a new array of filtered values.
     * @example
     *
     * _.compact([0, 1, false, 2, '', 3]);
     * // => [1, 2, 3]
     */
    function compact(array) {
      var index = -1,
          length = array ? array.length : 0,
          result = [];

      while (++index < length) {
        var value = array[index];
        if (value) {
          result.push(value);
        }
      }
      return result;
    }

    /**
     * Creates an array excluding all values of the provided arrays using strict
     * equality for comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to process.
     * @param {...Array} [values] The arrays of values to exclude.
     * @returns {Array} Returns a new array of filtered values.
     * @example
     *
     * _.difference([1, 2, 3, 4, 5], [5, 2, 10]);
     * // => [1, 3, 4]
     */
    function difference(array) {
      return baseDifference(array, baseFlatten(arguments, true, true, 1));
    }

    /**
     * This method is like `_.find` except that it returns the index of the first
     * element that passes the callback check, instead of the element itself.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {number} Returns the index of the found element, else `-1`.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36, 'blocked': false },
     *   { 'name': 'fred',    'age': 40, 'blocked': true },
     *   { 'name': 'pebbles', 'age': 1,  'blocked': false }
     * ];
     *
     * _.findIndex(characters, function(chr) {
     *   return chr.age < 20;
     * });
     * // => 2
     *
     * // using "_.where" callback shorthand
     * _.findIndex(characters, { 'age': 36 });
     * // => 0
     *
     * // using "_.pluck" callback shorthand
     * _.findIndex(characters, 'blocked');
     * // => 1
     */
    function findIndex(array, callback, thisArg) {
      var index = -1,
          length = array ? array.length : 0;

      callback = lodash.createCallback(callback, thisArg, 3);
      while (++index < length) {
        if (callback(array[index], index, array)) {
          return index;
        }
      }
      return -1;
    }

    /**
     * This method is like `_.findIndex` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {number} Returns the index of the found element, else `-1`.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36, 'blocked': true },
     *   { 'name': 'fred',    'age': 40, 'blocked': false },
     *   { 'name': 'pebbles', 'age': 1,  'blocked': true }
     * ];
     *
     * _.findLastIndex(characters, function(chr) {
     *   return chr.age > 30;
     * });
     * // => 1
     *
     * // using "_.where" callback shorthand
     * _.findLastIndex(characters, { 'age': 36 });
     * // => 0
     *
     * // using "_.pluck" callback shorthand
     * _.findLastIndex(characters, 'blocked');
     * // => 2
     */
    function findLastIndex(array, callback, thisArg) {
      var length = array ? array.length : 0;
      callback = lodash.createCallback(callback, thisArg, 3);
      while (length--) {
        if (callback(array[length], length, array)) {
          return length;
        }
      }
      return -1;
    }

    /**
     * Gets the first element or first `n` elements of an array. If a callback
     * is provided elements at the beginning of the array are returned as long
     * as the callback returns truey. The callback is bound to `thisArg` and
     * invoked with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias head, take
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback] The function called
     *  per element or the number of elements to return. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the first element(s) of `array`.
     * @example
     *
     * _.first([1, 2, 3]);
     * // => 1
     *
     * _.first([1, 2, 3], 2);
     * // => [1, 2]
     *
     * _.first([1, 2, 3], function(num) {
     *   return num < 3;
     * });
     * // => [1, 2]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': true,  'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': false, 'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.first(characters, 'blocked');
     * // => [{ 'name': 'barney', 'blocked': true, 'employer': 'slate' }]
     *
     * // using "_.where" callback shorthand
     * _.pluck(_.first(characters, { 'employer': 'slate' }), 'name');
     * // => ['barney', 'fred']
     */
    function first(array, callback, thisArg) {
      var n = 0,
          length = array ? array.length : 0;

      if (typeof callback != 'number' && callback != null) {
        var index = -1;
        callback = lodash.createCallback(callback, thisArg, 3);
        while (++index < length && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = callback;
        if (n == null || thisArg) {
          return array ? array[0] : undefined;
        }
      }
      return slice(array, 0, nativeMin(nativeMax(0, n), length));
    }

    /**
     * Flattens a nested array (the nesting can be to any depth). If `isShallow`
     * is truey, the array will only be flattened a single level. If a callback
     * is provided each element of the array is passed through the callback before
     * flattening. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to flatten.
     * @param {boolean} [isShallow=false] A flag to restrict flattening to a single level.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new flattened array.
     * @example
     *
     * _.flatten([1, [2], [3, [[4]]]]);
     * // => [1, 2, 3, 4];
     *
     * _.flatten([1, [2], [3, [[4]]]], true);
     * // => [1, 2, 3, [[4]]];
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 30, 'pets': ['hoppy'] },
     *   { 'name': 'fred',   'age': 40, 'pets': ['baby puss', 'dino'] }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.flatten(characters, 'pets');
     * // => ['hoppy', 'baby puss', 'dino']
     */
    function flatten(array, isShallow, callback, thisArg) {
      // juggle arguments
      if (typeof isShallow != 'boolean' && isShallow != null) {
        thisArg = callback;
        callback = (typeof isShallow != 'function' && thisArg && thisArg[isShallow] === array) ? null : isShallow;
        isShallow = false;
      }
      if (callback != null) {
        array = map(array, callback, thisArg);
      }
      return baseFlatten(array, isShallow);
    }

    /**
     * Gets the index at which the first occurrence of `value` is found using
     * strict equality for comparisons, i.e. `===`. If the array is already sorted
     * providing `true` for `fromIndex` will run a faster binary search.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {*} value The value to search for.
     * @param {boolean|number} [fromIndex=0] The index to search from or `true`
     *  to perform a binary search on a sorted array.
     * @returns {number} Returns the index of the matched value or `-1`.
     * @example
     *
     * _.indexOf([1, 2, 3, 1, 2, 3], 2);
     * // => 1
     *
     * _.indexOf([1, 2, 3, 1, 2, 3], 2, 3);
     * // => 4
     *
     * _.indexOf([1, 1, 2, 2, 3, 3], 2, true);
     * // => 2
     */
    function indexOf(array, value, fromIndex) {
      if (typeof fromIndex == 'number') {
        var length = array ? array.length : 0;
        fromIndex = (fromIndex < 0 ? nativeMax(0, length + fromIndex) : fromIndex || 0);
      } else if (fromIndex) {
        var index = sortedIndex(array, value);
        return array[index] === value ? index : -1;
      }
      return baseIndexOf(array, value, fromIndex);
    }

    /**
     * Gets all but the last element or last `n` elements of an array. If a
     * callback is provided elements at the end of the array are excluded from
     * the result as long as the callback returns truey. The callback is bound
     * to `thisArg` and invoked with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback=1] The function called
     *  per element or the number of elements to exclude. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a slice of `array`.
     * @example
     *
     * _.initial([1, 2, 3]);
     * // => [1, 2]
     *
     * _.initial([1, 2, 3], 2);
     * // => [1]
     *
     * _.initial([1, 2, 3], function(num) {
     *   return num > 1;
     * });
     * // => [1]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': false, 'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': true,  'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.initial(characters, 'blocked');
     * // => [{ 'name': 'barney',  'blocked': false, 'employer': 'slate' }]
     *
     * // using "_.where" callback shorthand
     * _.pluck(_.initial(characters, { 'employer': 'na' }), 'name');
     * // => ['barney', 'fred']
     */
    function initial(array, callback, thisArg) {
      var n = 0,
          length = array ? array.length : 0;

      if (typeof callback != 'number' && callback != null) {
        var index = length;
        callback = lodash.createCallback(callback, thisArg, 3);
        while (index-- && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = (callback == null || thisArg) ? 1 : callback || n;
      }
      return slice(array, 0, nativeMin(nativeMax(0, length - n), length));
    }

    /**
     * Creates an array of unique values present in all provided arrays using
     * strict equality for comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {...Array} [array] The arrays to inspect.
     * @returns {Array} Returns an array of shared values.
     * @example
     *
     * _.intersection([1, 2, 3], [5, 2, 1, 4], [2, 1]);
     * // => [1, 2]
     */
    function intersection() {
      var args = [],
          argsIndex = -1,
          argsLength = arguments.length,
          caches = getArray(),
          indexOf = getIndexOf(),
          trustIndexOf = indexOf === baseIndexOf,
          seen = getArray();

      while (++argsIndex < argsLength) {
        var value = arguments[argsIndex];
        if (isArray(value) || isArguments(value)) {
          args.push(value);
          caches.push(trustIndexOf && value.length >= largeArraySize &&
            createCache(argsIndex ? args[argsIndex] : seen));
        }
      }
      var array = args[0],
          index = -1,
          length = array ? array.length : 0,
          result = [];

      outer:
      while (++index < length) {
        var cache = caches[0];
        value = array[index];

        if ((cache ? cacheIndexOf(cache, value) : indexOf(seen, value)) < 0) {
          argsIndex = argsLength;
          (cache || seen).push(value);
          while (--argsIndex) {
            cache = caches[argsIndex];
            if ((cache ? cacheIndexOf(cache, value) : indexOf(args[argsIndex], value)) < 0) {
              continue outer;
            }
          }
          result.push(value);
        }
      }
      while (argsLength--) {
        cache = caches[argsLength];
        if (cache) {
          releaseObject(cache);
        }
      }
      releaseArray(caches);
      releaseArray(seen);
      return result;
    }

    /**
     * Gets the last element or last `n` elements of an array. If a callback is
     * provided elements at the end of the array are returned as long as the
     * callback returns truey. The callback is bound to `thisArg` and invoked
     * with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback] The function called
     *  per element or the number of elements to return. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the last element(s) of `array`.
     * @example
     *
     * _.last([1, 2, 3]);
     * // => 3
     *
     * _.last([1, 2, 3], 2);
     * // => [2, 3]
     *
     * _.last([1, 2, 3], function(num) {
     *   return num > 1;
     * });
     * // => [2, 3]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': false, 'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': true,  'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.pluck(_.last(characters, 'blocked'), 'name');
     * // => ['fred', 'pebbles']
     *
     * // using "_.where" callback shorthand
     * _.last(characters, { 'employer': 'na' });
     * // => [{ 'name': 'pebbles', 'blocked': true, 'employer': 'na' }]
     */
    function last(array, callback, thisArg) {
      var n = 0,
          length = array ? array.length : 0;

      if (typeof callback != 'number' && callback != null) {
        var index = length;
        callback = lodash.createCallback(callback, thisArg, 3);
        while (index-- && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = callback;
        if (n == null || thisArg) {
          return array ? array[length - 1] : undefined;
        }
      }
      return slice(array, nativeMax(0, length - n));
    }

    /**
     * Gets the index at which the last occurrence of `value` is found using strict
     * equality for comparisons, i.e. `===`. If `fromIndex` is negative, it is used
     * as the offset from the end of the collection.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {*} value The value to search for.
     * @param {number} [fromIndex=array.length-1] The index to search from.
     * @returns {number} Returns the index of the matched value or `-1`.
     * @example
     *
     * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2);
     * // => 4
     *
     * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2, 3);
     * // => 1
     */
    function lastIndexOf(array, value, fromIndex) {
      var index = array ? array.length : 0;
      if (typeof fromIndex == 'number') {
        index = (fromIndex < 0 ? nativeMax(0, index + fromIndex) : nativeMin(fromIndex, index - 1)) + 1;
      }
      while (index--) {
        if (array[index] === value) {
          return index;
        }
      }
      return -1;
    }

    /**
     * Removes all provided values from the given array using strict equality for
     * comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to modify.
     * @param {...*} [value] The values to remove.
     * @returns {Array} Returns `array`.
     * @example
     *
     * var array = [1, 2, 3, 1, 2, 3];
     * _.pull(array, 2, 3);
     * console.log(array);
     * // => [1, 1]
     */
    function pull(array) {
      var args = arguments,
          argsIndex = 0,
          argsLength = args.length,
          length = array ? array.length : 0;

      while (++argsIndex < argsLength) {
        var index = -1,
            value = args[argsIndex];
        while (++index < length) {
          if (array[index] === value) {
            splice.call(array, index--, 1);
            length--;
          }
        }
      }
      return array;
    }

    /**
     * Creates an array of numbers (positive and/or negative) progressing from
     * `start` up to but not including `end`. If `start` is less than `stop` a
     * zero-length range is created unless a negative `step` is specified.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {number} [start=0] The start of the range.
     * @param {number} end The end of the range.
     * @param {number} [step=1] The value to increment or decrement by.
     * @returns {Array} Returns a new range array.
     * @example
     *
     * _.range(4);
     * // => [0, 1, 2, 3]
     *
     * _.range(1, 5);
     * // => [1, 2, 3, 4]
     *
     * _.range(0, 20, 5);
     * // => [0, 5, 10, 15]
     *
     * _.range(0, -4, -1);
     * // => [0, -1, -2, -3]
     *
     * _.range(1, 4, 0);
     * // => [1, 1, 1]
     *
     * _.range(0);
     * // => []
     */
    function range(start, end, step) {
      start = +start || 0;
      step = typeof step == 'number' ? step : (+step || 1);

      if (end == null) {
        end = start;
        start = 0;
      }
      // use `Array(length)` so engines like Chakra and V8 avoid slower modes
      // http://youtu.be/XAqIpGU8ZZk#t=17m25s
      var index = -1,
          length = nativeMax(0, ceil((end - start) / (step || 1))),
          result = Array(length);

      while (++index < length) {
        result[index] = start;
        start += step;
      }
      return result;
    }

    /**
     * Removes all elements from an array that the callback returns truey for
     * and returns an array of removed elements. The callback is bound to `thisArg`
     * and invoked with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to modify.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of removed elements.
     * @example
     *
     * var array = [1, 2, 3, 4, 5, 6];
     * var evens = _.remove(array, function(num) { return num % 2 == 0; });
     *
     * console.log(array);
     * // => [1, 3, 5]
     *
     * console.log(evens);
     * // => [2, 4, 6]
     */
    function remove(array, callback, thisArg) {
      var index = -1,
          length = array ? array.length : 0,
          result = [];

      callback = lodash.createCallback(callback, thisArg, 3);
      while (++index < length) {
        var value = array[index];
        if (callback(value, index, array)) {
          result.push(value);
          splice.call(array, index--, 1);
          length--;
        }
      }
      return result;
    }

    /**
     * The opposite of `_.initial` this method gets all but the first element or
     * first `n` elements of an array. If a callback function is provided elements
     * at the beginning of the array are excluded from the result as long as the
     * callback returns truey. The callback is bound to `thisArg` and invoked
     * with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias drop, tail
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback=1] The function called
     *  per element or the number of elements to exclude. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a slice of `array`.
     * @example
     *
     * _.rest([1, 2, 3]);
     * // => [2, 3]
     *
     * _.rest([1, 2, 3], 2);
     * // => [3]
     *
     * _.rest([1, 2, 3], function(num) {
     *   return num < 3;
     * });
     * // => [3]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': true,  'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': false,  'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true, 'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.pluck(_.rest(characters, 'blocked'), 'name');
     * // => ['fred', 'pebbles']
     *
     * // using "_.where" callback shorthand
     * _.rest(characters, { 'employer': 'slate' });
     * // => [{ 'name': 'pebbles', 'blocked': true, 'employer': 'na' }]
     */
    function rest(array, callback, thisArg) {
      if (typeof callback != 'number' && callback != null) {
        var n = 0,
            index = -1,
            length = array ? array.length : 0;

        callback = lodash.createCallback(callback, thisArg, 3);
        while (++index < length && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = (callback == null || thisArg) ? 1 : nativeMax(0, callback);
      }
      return slice(array, n);
    }

    /**
     * Uses a binary search to determine the smallest index at which a value
     * should be inserted into a given sorted array in order to maintain the sort
     * order of the array. If a callback is provided it will be executed for
     * `value` and each element of `array` to compute their sort ranking. The
     * callback is bound to `thisArg` and invoked with one argument; (value).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to inspect.
     * @param {*} value The value to evaluate.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {number} Returns the index at which `value` should be inserted
     *  into `array`.
     * @example
     *
     * _.sortedIndex([20, 30, 50], 40);
     * // => 2
     *
     * // using "_.pluck" callback shorthand
     * _.sortedIndex([{ 'x': 20 }, { 'x': 30 }, { 'x': 50 }], { 'x': 40 }, 'x');
     * // => 2
     *
     * var dict = {
     *   'wordToNumber': { 'twenty': 20, 'thirty': 30, 'fourty': 40, 'fifty': 50 }
     * };
     *
     * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
     *   return dict.wordToNumber[word];
     * });
     * // => 2
     *
     * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
     *   return this.wordToNumber[word];
     * }, dict);
     * // => 2
     */
    function sortedIndex(array, value, callback, thisArg) {
      var low = 0,
          high = array ? array.length : low;

      // explicitly reference `identity` for better inlining in Firefox
      callback = callback ? lodash.createCallback(callback, thisArg, 1) : identity;
      value = callback(value);

      while (low < high) {
        var mid = (low + high) >>> 1;
        (callback(array[mid]) < value)
          ? low = mid + 1
          : high = mid;
      }
      return low;
    }

    /**
     * Creates an array of unique values, in order, of the provided arrays using
     * strict equality for comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {...Array} [array] The arrays to inspect.
     * @returns {Array} Returns an array of combined values.
     * @example
     *
     * _.union([1, 2, 3], [5, 2, 1, 4], [2, 1]);
     * // => [1, 2, 3, 5, 4]
     */
    function union() {
      return baseUniq(baseFlatten(arguments, true, true));
    }

    /**
     * Creates a duplicate-value-free version of an array using strict equality
     * for comparisons, i.e. `===`. If the array is sorted, providing
     * `true` for `isSorted` will use a faster algorithm. If a callback is provided
     * each element of `array` is passed through the callback before uniqueness
     * is computed. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias unique
     * @category Arrays
     * @param {Array} array The array to process.
     * @param {boolean} [isSorted=false] A flag to indicate that `array` is sorted.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a duplicate-value-free array.
     * @example
     *
     * _.uniq([1, 2, 1, 3, 1]);
     * // => [1, 2, 3]
     *
     * _.uniq([1, 1, 2, 2, 3], true);
     * // => [1, 2, 3]
     *
     * _.uniq(['A', 'b', 'C', 'a', 'B', 'c'], function(letter) { return letter.toLowerCase(); });
     * // => ['A', 'b', 'C']
     *
     * _.uniq([1, 2.5, 3, 1.5, 2, 3.5], function(num) { return this.floor(num); }, Math);
     * // => [1, 2.5, 3]
     *
     * // using "_.pluck" callback shorthand
     * _.uniq([{ 'x': 1 }, { 'x': 2 }, { 'x': 1 }], 'x');
     * // => [{ 'x': 1 }, { 'x': 2 }]
     */
    function uniq(array, isSorted, callback, thisArg) {
      // juggle arguments
      if (typeof isSorted != 'boolean' && isSorted != null) {
        thisArg = callback;
        callback = (typeof isSorted != 'function' && thisArg && thisArg[isSorted] === array) ? null : isSorted;
        isSorted = false;
      }
      if (callback != null) {
        callback = lodash.createCallback(callback, thisArg, 3);
      }
      return baseUniq(array, isSorted, callback);
    }

    /**
     * Creates an array excluding all provided values using strict equality for
     * comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to filter.
     * @param {...*} [value] The values to exclude.
     * @returns {Array} Returns a new array of filtered values.
     * @example
     *
     * _.without([1, 2, 1, 0, 3, 1, 4], 0, 1);
     * // => [2, 3, 4]
     */
    function without(array) {
      return baseDifference(array, slice(arguments, 1));
    }

    /**
     * Creates an array that is the symmetric difference of the provided arrays.
     * See http://en.wikipedia.org/wiki/Symmetric_difference.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {...Array} [array] The arrays to inspect.
     * @returns {Array} Returns an array of values.
     * @example
     *
     * _.xor([1, 2, 3], [5, 2, 1, 4]);
     * // => [3, 5, 4]
     *
     * _.xor([1, 2, 5], [2, 3, 5], [3, 4, 5]);
     * // => [1, 4, 5]
     */
    function xor() {
      var index = -1,
          length = arguments.length;

      while (++index < length) {
        var array = arguments[index];
        if (isArray(array) || isArguments(array)) {
          var result = result
            ? baseUniq(baseDifference(result, array).concat(baseDifference(array, result)))
            : array;
        }
      }
      return result || [];
    }

    /**
     * Creates an array of grouped elements, the first of which contains the first
     * elements of the given arrays, the second of which contains the second
     * elements of the given arrays, and so on.
     *
     * @static
     * @memberOf _
     * @alias unzip
     * @category Arrays
     * @param {...Array} [array] Arrays to process.
     * @returns {Array} Returns a new array of grouped elements.
     * @example
     *
     * _.zip(['fred', 'barney'], [30, 40], [true, false]);
     * // => [['fred', 30, true], ['barney', 40, false]]
     */
    function zip() {
      var array = arguments.length > 1 ? arguments : arguments[0],
          index = -1,
          length = array ? max(pluck(array, 'length')) : 0,
          result = Array(length < 0 ? 0 : length);

      while (++index < length) {
        result[index] = pluck(array, index);
      }
      return result;
    }

    /**
     * Creates an object composed from arrays of `keys` and `values`. Provide
     * either a single two dimensional array, i.e. `[[key1, value1], [key2, value2]]`
     * or two arrays, one of `keys` and one of corresponding `values`.
     *
     * @static
     * @memberOf _
     * @alias object
     * @category Arrays
     * @param {Array} keys The array of keys.
     * @param {Array} [values=[]] The array of values.
     * @returns {Object} Returns an object composed of the given keys and
     *  corresponding values.
     * @example
     *
     * _.zipObject(['fred', 'barney'], [30, 40]);
     * // => { 'fred': 30, 'barney': 40 }
     */
    function zipObject(keys, values) {
      var index = -1,
          length = keys ? keys.length : 0,
          result = {};

      if (!values && length && !isArray(keys[0])) {
        values = [];
      }
      while (++index < length) {
        var key = keys[index];
        if (values) {
          result[key] = values[index];
        } else if (key) {
          result[key[0]] = key[1];
        }
      }
      return result;
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a function that executes `func`, with  the `this` binding and
     * arguments of the created function, only after being called `n` times.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {number} n The number of times the function must be called before
     *  `func` is executed.
     * @param {Function} func The function to restrict.
     * @returns {Function} Returns the new restricted function.
     * @example
     *
     * var saves = ['profile', 'settings'];
     *
     * var done = _.after(saves.length, function() {
     *   console.log('Done saving!');
     * });
     *
     * _.forEach(saves, function(type) {
     *   asyncSave({ 'type': type, 'complete': done });
     * });
     * // => logs 'Done saving!', after all saves have completed
     */
    function after(n, func) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      return function() {
        if (--n < 1) {
          return func.apply(this, arguments);
        }
      };
    }

    /**
     * Creates a function that, when called, invokes `func` with the `this`
     * binding of `thisArg` and prepends any additional `bind` arguments to those
     * provided to the bound function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to bind.
     * @param {*} [thisArg] The `this` binding of `func`.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new bound function.
     * @example
     *
     * var func = function(greeting) {
     *   return greeting + ' ' + this.name;
     * };
     *
     * func = _.bind(func, { 'name': 'fred' }, 'hi');
     * func();
     * // => 'hi fred'
     */
    function bind(func, thisArg) {
      return arguments.length > 2
        ? createWrapper(func, 17, slice(arguments, 2), null, thisArg)
        : createWrapper(func, 1, null, null, thisArg);
    }

    /**
     * Binds methods of an object to the object itself, overwriting the existing
     * method. Method names may be specified as individual arguments or as arrays
     * of method names. If no method names are provided all the function properties
     * of `object` will be bound.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Object} object The object to bind and assign the bound methods to.
     * @param {...string} [methodName] The object method names to
     *  bind, specified as individual method names or arrays of method names.
     * @returns {Object} Returns `object`.
     * @example
     *
     * var view = {
     *   'label': 'docs',
     *   'onClick': function() { console.log('clicked ' + this.label); }
     * };
     *
     * _.bindAll(view);
     * jQuery('#docs').on('click', view.onClick);
     * // => logs 'clicked docs', when the button is clicked
     */
    function bindAll(object) {
      var funcs = arguments.length > 1 ? baseFlatten(arguments, true, false, 1) : functions(object),
          index = -1,
          length = funcs.length;

      while (++index < length) {
        var key = funcs[index];
        object[key] = createWrapper(object[key], 1, null, null, object);
      }
      return object;
    }

    /**
     * Creates a function that, when called, invokes the method at `object[key]`
     * and prepends any additional `bindKey` arguments to those provided to the bound
     * function. This method differs from `_.bind` by allowing bound functions to
     * reference methods that will be redefined or don't yet exist.
     * See http://michaux.ca/articles/lazy-function-definition-pattern.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Object} object The object the method belongs to.
     * @param {string} key The key of the method.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new bound function.
     * @example
     *
     * var object = {
     *   'name': 'fred',
     *   'greet': function(greeting) {
     *     return greeting + ' ' + this.name;
     *   }
     * };
     *
     * var func = _.bindKey(object, 'greet', 'hi');
     * func();
     * // => 'hi fred'
     *
     * object.greet = function(greeting) {
     *   return greeting + 'ya ' + this.name + '!';
     * };
     *
     * func();
     * // => 'hiya fred!'
     */
    function bindKey(object, key) {
      return arguments.length > 2
        ? createWrapper(key, 19, slice(arguments, 2), null, object)
        : createWrapper(key, 3, null, null, object);
    }

    /**
     * Creates a function that is the composition of the provided functions,
     * where each function consumes the return value of the function that follows.
     * For example, composing the functions `f()`, `g()`, and `h()` produces `f(g(h()))`.
     * Each function is executed with the `this` binding of the composed function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {...Function} [func] Functions to compose.
     * @returns {Function} Returns the new composed function.
     * @example
     *
     * var realNameMap = {
     *   'pebbles': 'penelope'
     * };
     *
     * var format = function(name) {
     *   name = realNameMap[name.toLowerCase()] || name;
     *   return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
     * };
     *
     * var greet = function(formatted) {
     *   return 'Hiya ' + formatted + '!';
     * };
     *
     * var welcome = _.compose(greet, format);
     * welcome('pebbles');
     * // => 'Hiya Penelope!'
     */
    function compose() {
      var funcs = arguments,
          length = funcs.length;

      while (length--) {
        if (!isFunction(funcs[length])) {
          throw new TypeError;
        }
      }
      return function() {
        var args = arguments,
            length = funcs.length;

        while (length--) {
          args = [funcs[length].apply(this, args)];
        }
        return args[0];
      };
    }

    /**
     * Creates a function which accepts one or more arguments of `func` that when
     * invoked either executes `func` returning its result, if all `func` arguments
     * have been provided, or returns a function that accepts one or more of the
     * remaining `func` arguments, and so on. The arity of `func` can be specified
     * if `func.length` is not sufficient.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to curry.
     * @param {number} [arity=func.length] The arity of `func`.
     * @returns {Function} Returns the new curried function.
     * @example
     *
     * var curried = _.curry(function(a, b, c) {
     *   console.log(a + b + c);
     * });
     *
     * curried(1)(2)(3);
     * // => 6
     *
     * curried(1, 2)(3);
     * // => 6
     *
     * curried(1, 2, 3);
     * // => 6
     */
    function curry(func, arity) {
      arity = typeof arity == 'number' ? arity : (+arity || func.length);
      return createWrapper(func, 4, null, null, null, arity);
    }

    /**
     * Creates a function that will delay the execution of `func` until after
     * `wait` milliseconds have elapsed since the last time it was invoked.
     * Provide an options object to indicate that `func` should be invoked on
     * the leading and/or trailing edge of the `wait` timeout. Subsequent calls
     * to the debounced function will return the result of the last `func` call.
     *
     * Note: If `leading` and `trailing` options are `true` `func` will be called
     * on the trailing edge of the timeout only if the the debounced function is
     * invoked more than once during the `wait` timeout.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to debounce.
     * @param {number} wait The number of milliseconds to delay.
     * @param {Object} [options] The options object.
     * @param {boolean} [options.leading=false] Specify execution on the leading edge of the timeout.
     * @param {number} [options.maxWait] The maximum time `func` is allowed to be delayed before it's called.
     * @param {boolean} [options.trailing=true] Specify execution on the trailing edge of the timeout.
     * @returns {Function} Returns the new debounced function.
     * @example
     *
     * // avoid costly calculations while the window size is in flux
     * var lazyLayout = _.debounce(calculateLayout, 150);
     * jQuery(window).on('resize', lazyLayout);
     *
     * // execute `sendMail` when the click event is fired, debouncing subsequent calls
     * jQuery('#postbox').on('click', _.debounce(sendMail, 300, {
     *   'leading': true,
     *   'trailing': false
     * });
     *
     * // ensure `batchLog` is executed once after 1 second of debounced calls
     * var source = new EventSource('/stream');
     * source.addEventListener('message', _.debounce(batchLog, 250, {
     *   'maxWait': 1000
     * }, false);
     */
    function debounce(func, wait, options) {
      var args,
          maxTimeoutId,
          result,
          stamp,
          thisArg,
          timeoutId,
          trailingCall,
          lastCalled = 0,
          maxWait = false,
          trailing = true;

      if (!isFunction(func)) {
        throw new TypeError;
      }
      wait = nativeMax(0, wait) || 0;
      if (options === true) {
        var leading = true;
        trailing = false;
      } else if (isObject(options)) {
        leading = options.leading;
        maxWait = 'maxWait' in options && (nativeMax(wait, options.maxWait) || 0);
        trailing = 'trailing' in options ? options.trailing : trailing;
      }
      var delayed = function() {
        var remaining = wait - (now() - stamp);
        if (remaining <= 0) {
          if (maxTimeoutId) {
            clearTimeout(maxTimeoutId);
          }
          var isCalled = trailingCall;
          maxTimeoutId = timeoutId = trailingCall = undefined;
          if (isCalled) {
            lastCalled = now();
            result = func.apply(thisArg, args);
            if (!timeoutId && !maxTimeoutId) {
              args = thisArg = null;
            }
          }
        } else {
          timeoutId = setTimeout(delayed, remaining);
        }
      };

      var maxDelayed = function() {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        maxTimeoutId = timeoutId = trailingCall = undefined;
        if (trailing || (maxWait !== wait)) {
          lastCalled = now();
          result = func.apply(thisArg, args);
          if (!timeoutId && !maxTimeoutId) {
            args = thisArg = null;
          }
        }
      };

      return function() {
        args = arguments;
        stamp = now();
        thisArg = this;
        trailingCall = trailing && (timeoutId || !leading);

        if (maxWait === false) {
          var leadingCall = leading && !timeoutId;
        } else {
          if (!maxTimeoutId && !leading) {
            lastCalled = stamp;
          }
          var remaining = maxWait - (stamp - lastCalled),
              isCalled = remaining <= 0;

          if (isCalled) {
            if (maxTimeoutId) {
              maxTimeoutId = clearTimeout(maxTimeoutId);
            }
            lastCalled = stamp;
            result = func.apply(thisArg, args);
          }
          else if (!maxTimeoutId) {
            maxTimeoutId = setTimeout(maxDelayed, remaining);
          }
        }
        if (isCalled && timeoutId) {
          timeoutId = clearTimeout(timeoutId);
        }
        else if (!timeoutId && wait !== maxWait) {
          timeoutId = setTimeout(delayed, wait);
        }
        if (leadingCall) {
          isCalled = true;
          result = func.apply(thisArg, args);
        }
        if (isCalled && !timeoutId && !maxTimeoutId) {
          args = thisArg = null;
        }
        return result;
      };
    }

    /**
     * Defers executing the `func` function until the current call stack has cleared.
     * Additional arguments will be provided to `func` when it is invoked.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to defer.
     * @param {...*} [arg] Arguments to invoke the function with.
     * @returns {number} Returns the timer id.
     * @example
     *
     * _.defer(function(text) { console.log(text); }, 'deferred');
     * // logs 'deferred' after one or more milliseconds
     */
    function defer(func) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      var args = slice(arguments, 1);
      return setTimeout(function() { func.apply(undefined, args); }, 1);
    }

    /**
     * Executes the `func` function after `wait` milliseconds. Additional arguments
     * will be provided to `func` when it is invoked.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to delay.
     * @param {number} wait The number of milliseconds to delay execution.
     * @param {...*} [arg] Arguments to invoke the function with.
     * @returns {number} Returns the timer id.
     * @example
     *
     * _.delay(function(text) { console.log(text); }, 1000, 'later');
     * // => logs 'later' after one second
     */
    function delay(func, wait) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      var args = slice(arguments, 2);
      return setTimeout(function() { func.apply(undefined, args); }, wait);
    }

    /**
     * Creates a function that memoizes the result of `func`. If `resolver` is
     * provided it will be used to determine the cache key for storing the result
     * based on the arguments provided to the memoized function. By default, the
     * first argument provided to the memoized function is used as the cache key.
     * The `func` is executed with the `this` binding of the memoized function.
     * The result cache is exposed as the `cache` property on the memoized function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to have its output memoized.
     * @param {Function} [resolver] A function used to resolve the cache key.
     * @returns {Function} Returns the new memoizing function.
     * @example
     *
     * var fibonacci = _.memoize(function(n) {
     *   return n < 2 ? n : fibonacci(n - 1) + fibonacci(n - 2);
     * });
     *
     * fibonacci(9)
     * // => 34
     *
     * var data = {
     *   'fred': { 'name': 'fred', 'age': 40 },
     *   'pebbles': { 'name': 'pebbles', 'age': 1 }
     * };
     *
     * // modifying the result cache
     * var get = _.memoize(function(name) { return data[name]; }, _.identity);
     * get('pebbles');
     * // => { 'name': 'pebbles', 'age': 1 }
     *
     * get.cache.pebbles.name = 'penelope';
     * get('pebbles');
     * // => { 'name': 'penelope', 'age': 1 }
     */
    function memoize(func, resolver) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      var memoized = function() {
        var cache = memoized.cache,
            key = resolver ? resolver.apply(this, arguments) : keyPrefix + arguments[0];

        return hasOwnProperty.call(cache, key)
          ? cache[key]
          : (cache[key] = func.apply(this, arguments));
      }
      memoized.cache = {};
      return memoized;
    }

    /**
     * Creates a function that is restricted to execute `func` once. Repeat calls to
     * the function will return the value of the first call. The `func` is executed
     * with the `this` binding of the created function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to restrict.
     * @returns {Function} Returns the new restricted function.
     * @example
     *
     * var initialize = _.once(createApplication);
     * initialize();
     * initialize();
     * // `initialize` executes `createApplication` once
     */
    function once(func) {
      var ran,
          result;

      if (!isFunction(func)) {
        throw new TypeError;
      }
      return function() {
        if (ran) {
          return result;
        }
        ran = true;
        result = func.apply(this, arguments);

        // clear the `func` variable so the function may be garbage collected
        func = null;
        return result;
      };
    }

    /**
     * Creates a function that, when called, invokes `func` with any additional
     * `partial` arguments prepended to those provided to the new function. This
     * method is similar to `_.bind` except it does **not** alter the `this` binding.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to partially apply arguments to.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new partially applied function.
     * @example
     *
     * var greet = function(greeting, name) { return greeting + ' ' + name; };
     * var hi = _.partial(greet, 'hi');
     * hi('fred');
     * // => 'hi fred'
     */
    function partial(func) {
      return createWrapper(func, 16, slice(arguments, 1));
    }

    /**
     * This method is like `_.partial` except that `partial` arguments are
     * appended to those provided to the new function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to partially apply arguments to.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new partially applied function.
     * @example
     *
     * var defaultsDeep = _.partialRight(_.merge, _.defaults);
     *
     * var options = {
     *   'variable': 'data',
     *   'imports': { 'jq': $ }
     * };
     *
     * defaultsDeep(options, _.templateSettings);
     *
     * options.variable
     * // => 'data'
     *
     * options.imports
     * // => { '_': _, 'jq': $ }
     */
    function partialRight(func) {
      return createWrapper(func, 32, null, slice(arguments, 1));
    }

    /**
     * Creates a function that, when executed, will only call the `func` function
     * at most once per every `wait` milliseconds. Provide an options object to
     * indicate that `func` should be invoked on the leading and/or trailing edge
     * of the `wait` timeout. Subsequent calls to the throttled function will
     * return the result of the last `func` call.
     *
     * Note: If `leading` and `trailing` options are `true` `func` will be called
     * on the trailing edge of the timeout only if the the throttled function is
     * invoked more than once during the `wait` timeout.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to throttle.
     * @param {number} wait The number of milliseconds to throttle executions to.
     * @param {Object} [options] The options object.
     * @param {boolean} [options.leading=true] Specify execution on the leading edge of the timeout.
     * @param {boolean} [options.trailing=true] Specify execution on the trailing edge of the timeout.
     * @returns {Function} Returns the new throttled function.
     * @example
     *
     * // avoid excessively updating the position while scrolling
     * var throttled = _.throttle(updatePosition, 100);
     * jQuery(window).on('scroll', throttled);
     *
     * // execute `renewToken` when the click event is fired, but not more than once every 5 minutes
     * jQuery('.interactive').on('click', _.throttle(renewToken, 300000, {
     *   'trailing': false
     * }));
     */
    function throttle(func, wait, options) {
      var leading = true,
          trailing = true;

      if (!isFunction(func)) {
        throw new TypeError;
      }
      if (options === false) {
        leading = false;
      } else if (isObject(options)) {
        leading = 'leading' in options ? options.leading : leading;
        trailing = 'trailing' in options ? options.trailing : trailing;
      }
      debounceOptions.leading = leading;
      debounceOptions.maxWait = wait;
      debounceOptions.trailing = trailing;

      return debounce(func, wait, debounceOptions);
    }

    /**
     * Creates a function that provides `value` to the wrapper function as its
     * first argument. Additional arguments provided to the function are appended
     * to those provided to the wrapper function. The wrapper is executed with
     * the `this` binding of the created function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {*} value The value to wrap.
     * @param {Function} wrapper The wrapper function.
     * @returns {Function} Returns the new function.
     * @example
     *
     * var p = _.wrap(_.escape, function(func, text) {
     *   return '<p>' + func(text) + '</p>';
     * });
     *
     * p('Fred, Wilma, & Pebbles');
     * // => '<p>Fred, Wilma, &amp; Pebbles</p>'
     */
    function wrap(value, wrapper) {
      return createWrapper(wrapper, 16, [value]);
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a function that returns `value`.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {*} value The value to return from the new function.
     * @returns {Function} Returns the new function.
     * @example
     *
     * var object = { 'name': 'fred' };
     * var getter = _.constant(object);
     * getter() === object;
     * // => true
     */
    function constant(value) {
      return function() {
        return value;
      };
    }

    /**
     * Produces a callback bound to an optional `thisArg`. If `func` is a property
     * name the created callback will return the property value for a given element.
     * If `func` is an object the created callback will return `true` for elements
     * that contain the equivalent object properties, otherwise it will return `false`.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {*} [func=identity] The value to convert to a callback.
     * @param {*} [thisArg] The `this` binding of the created callback.
     * @param {number} [argCount] The number of arguments the callback accepts.
     * @returns {Function} Returns a callback function.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // wrap to create custom callback shorthands
     * _.createCallback = _.wrap(_.createCallback, function(func, callback, thisArg) {
     *   var match = /^(.+?)__([gl]t)(.+)$/.exec(callback);
     *   return !match ? func(callback, thisArg) : function(object) {
     *     return match[2] == 'gt' ? object[match[1]] > match[3] : object[match[1]] < match[3];
     *   };
     * });
     *
     * _.filter(characters, 'age__gt38');
     * // => [{ 'name': 'fred', 'age': 40 }]
     */
    function createCallback(func, thisArg, argCount) {
      var type = typeof func;
      if (func == null || type == 'function') {
        return baseCreateCallback(func, thisArg, argCount);
      }
      // handle "_.pluck" style callback shorthands
      if (type != 'object') {
        return property(func);
      }
      var props = keys(func),
          key = props[0],
          a = func[key];

      // handle "_.where" style callback shorthands
      if (props.length == 1 && a === a && !isObject(a)) {
        // fast path the common case of providing an object with a single
        // property containing a primitive value
        return function(object) {
          var b = object[key];
          return a === b && (a !== 0 || (1 / a == 1 / b));
        };
      }
      return function(object) {
        var length = props.length,
            result = false;

        while (length--) {
          if (!(result = baseIsEqual(object[props[length]], func[props[length]], null, true))) {
            break;
          }
        }
        return result;
      };
    }

    /**
     * Converts the characters `&`, `<`, `>`, `"`, and `'` in `string` to their
     * corresponding HTML entities.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} string The string to escape.
     * @returns {string} Returns the escaped string.
     * @example
     *
     * _.escape('Fred, Wilma, & Pebbles');
     * // => 'Fred, Wilma, &amp; Pebbles'
     */
    function escape(string) {
      return string == null ? '' : String(string).replace(reUnescapedHtml, escapeHtmlChar);
    }

    /**
     * This method returns the first argument provided to it.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {*} value Any value.
     * @returns {*} Returns `value`.
     * @example
     *
     * var object = { 'name': 'fred' };
     * _.identity(object) === object;
     * // => true
     */
    function identity(value) {
      return value;
    }

    /**
     * Adds function properties of a source object to the destination object.
     * If `object` is a function methods will be added to its prototype as well.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {Function|Object} [object=lodash] object The destination object.
     * @param {Object} source The object of functions to add.
     * @param {Object} [options] The options object.
     * @param {boolean} [options.chain=true] Specify whether the functions added are chainable.
     * @example
     *
     * function capitalize(string) {
     *   return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
     * }
     *
     * _.mixin({ 'capitalize': capitalize });
     * _.capitalize('fred');
     * // => 'Fred'
     *
     * _('fred').capitalize().value();
     * // => 'Fred'
     *
     * _.mixin({ 'capitalize': capitalize }, { 'chain': false });
     * _('fred').capitalize();
     * // => 'Fred'
     */
    function mixin(object, source, options) {
      var chain = true,
          methodNames = source && functions(source);

      if (!source || (!options && !methodNames.length)) {
        if (options == null) {
          options = source;
        }
        ctor = lodashWrapper;
        source = object;
        object = lodash;
        methodNames = functions(source);
      }
      if (options === false) {
        chain = false;
      } else if (isObject(options) && 'chain' in options) {
        chain = options.chain;
      }
      var ctor = object,
          isFunc = isFunction(ctor);

      forEach(methodNames, function(methodName) {
        var func = object[methodName] = source[methodName];
        if (isFunc) {
          ctor.prototype[methodName] = function() {
            var chainAll = this.__chain__,
                value = this.__wrapped__,
                args = [value];

            push.apply(args, arguments);
            var result = func.apply(object, args);
            if (chain || chainAll) {
              if (value === result && isObject(result)) {
                return this;
              }
              result = new ctor(result);
              result.__chain__ = chainAll;
            }
            return result;
          };
        }
      });
    }

    /**
     * Reverts the '_' variable to its previous value and returns a reference to
     * the `lodash` function.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @returns {Function} Returns the `lodash` function.
     * @example
     *
     * var lodash = _.noConflict();
     */
    function noConflict() {
      context._ = oldDash;
      return this;
    }

    /**
     * A no-operation function.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @example
     *
     * var object = { 'name': 'fred' };
     * _.noop(object) === undefined;
     * // => true
     */
    function noop() {
      // no operation performed
    }

    /**
     * Gets the number of milliseconds that have elapsed since the Unix epoch
     * (1 January 1970 00:00:00 UTC).
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @example
     *
     * var stamp = _.now();
     * _.defer(function() { console.log(_.now() - stamp); });
     * // => logs the number of milliseconds it took for the deferred function to be called
     */
    var now = isNative(now = Date.now) && now || function() {
      return new Date().getTime();
    };

    /**
     * Converts the given value into an integer of the specified radix.
     * If `radix` is `undefined` or `0` a `radix` of `10` is used unless the
     * `value` is a hexadecimal, in which case a `radix` of `16` is used.
     *
     * Note: This method avoids differences in native ES3 and ES5 `parseInt`
     * implementations. See http://es5.github.io/#E.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} value The value to parse.
     * @param {number} [radix] The radix used to interpret the value to parse.
     * @returns {number} Returns the new integer value.
     * @example
     *
     * _.parseInt('08');
     * // => 8
     */
    var parseInt = nativeParseInt(whitespace + '08') == 8 ? nativeParseInt : function(value, radix) {
      // Firefox < 21 and Opera < 15 follow the ES3 specified implementation of `parseInt`
      return nativeParseInt(isString(value) ? value.replace(reLeadingSpacesAndZeros, '') : value, radix || 0);
    };

    /**
     * Creates a "_.pluck" style function, which returns the `key` value of a
     * given object.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} key The name of the property to retrieve.
     * @returns {Function} Returns the new function.
     * @example
     *
     * var characters = [
     *   { 'name': 'fred',   'age': 40 },
     *   { 'name': 'barney', 'age': 36 }
     * ];
     *
     * var getName = _.property('name');
     *
     * _.map(characters, getName);
     * // => ['barney', 'fred']
     *
     * _.sortBy(characters, getName);
     * // => [{ 'name': 'barney', 'age': 36 }, { 'name': 'fred',   'age': 40 }]
     */
    function property(key) {
      return function(object) {
        return object[key];
      };
    }

    /**
     * Produces a random number between `min` and `max` (inclusive). If only one
     * argument is provided a number between `0` and the given number will be
     * returned. If `floating` is truey or either `min` or `max` are floats a
     * floating-point number will be returned instead of an integer.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {number} [min=0] The minimum possible value.
     * @param {number} [max=1] The maximum possible value.
     * @param {boolean} [floating=false] Specify returning a floating-point number.
     * @returns {number} Returns a random number.
     * @example
     *
     * _.random(0, 5);
     * // => an integer between 0 and 5
     *
     * _.random(5);
     * // => also an integer between 0 and 5
     *
     * _.random(5, true);
     * // => a floating-point number between 0 and 5
     *
     * _.random(1.2, 5.2);
     * // => a floating-point number between 1.2 and 5.2
     */
    function random(min, max, floating) {
      var noMin = min == null,
          noMax = max == null;

      if (floating == null) {
        if (typeof min == 'boolean' && noMax) {
          floating = min;
          min = 1;
        }
        else if (!noMax && typeof max == 'boolean') {
          floating = max;
          noMax = true;
        }
      }
      if (noMin && noMax) {
        max = 1;
      }
      min = +min || 0;
      if (noMax) {
        max = min;
        min = 0;
      } else {
        max = +max || 0;
      }
      if (floating || min % 1 || max % 1) {
        var rand = nativeRandom();
        return nativeMin(min + (rand * (max - min + parseFloat('1e-' + ((rand +'').length - 1)))), max);
      }
      return baseRandom(min, max);
    }

    /**
     * Resolves the value of property `key` on `object`. If `key` is a function
     * it will be invoked with the `this` binding of `object` and its result returned,
     * else the property value is returned. If `object` is falsey then `undefined`
     * is returned.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {Object} object The object to inspect.
     * @param {string} key The name of the property to resolve.
     * @returns {*} Returns the resolved value.
     * @example
     *
     * var object = {
     *   'cheese': 'crumpets',
     *   'stuff': function() {
     *     return 'nonsense';
     *   }
     * };
     *
     * _.result(object, 'cheese');
     * // => 'crumpets'
     *
     * _.result(object, 'stuff');
     * // => 'nonsense'
     */
    function result(object, key) {
      if (object) {
        var value = object[key];
        return isFunction(value) ? object[key]() : value;
      }
    }

    /**
     * A micro-templating method that handles arbitrary delimiters, preserves
     * whitespace, and correctly escapes quotes within interpolated code.
     *
     * Note: In the development build, `_.template` utilizes sourceURLs for easier
     * debugging. See http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl
     *
     * For more information on precompiling templates see:
     * http://lodash.com/custom-builds
     *
     * For more information on Chrome extension sandboxes see:
     * http://developer.chrome.com/stable/extensions/sandboxingEval.html
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} text The template text.
     * @param {Object} data The data object used to populate the text.
     * @param {Object} [options] The options object.
     * @param {RegExp} [options.escape] The "escape" delimiter.
     * @param {RegExp} [options.evaluate] The "evaluate" delimiter.
     * @param {Object} [options.imports] An object to import into the template as local variables.
     * @param {RegExp} [options.interpolate] The "interpolate" delimiter.
     * @param {string} [sourceURL] The sourceURL of the template's compiled source.
     * @param {string} [variable] The data object variable name.
     * @returns {Function|string} Returns a compiled function when no `data` object
     *  is given, else it returns the interpolated text.
     * @example
     *
     * // using the "interpolate" delimiter to create a compiled template
     * var compiled = _.template('hello <%= name %>');
     * compiled({ 'name': 'fred' });
     * // => 'hello fred'
     *
     * // using the "escape" delimiter to escape HTML in data property values
     * _.template('<b><%- value %></b>', { 'value': '<script>' });
     * // => '<b>&lt;script&gt;</b>'
     *
     * // using the "evaluate" delimiter to generate HTML
     * var list = '<% _.forEach(people, function(name) { %><li><%- name %></li><% }); %>';
     * _.template(list, { 'people': ['fred', 'barney'] });
     * // => '<li>fred</li><li>barney</li>'
     *
     * // using the ES6 delimiter as an alternative to the default "interpolate" delimiter
     * _.template('hello ${ name }', { 'name': 'pebbles' });
     * // => 'hello pebbles'
     *
     * // using the internal `print` function in "evaluate" delimiters
     * _.template('<% print("hello " + name); %>!', { 'name': 'barney' });
     * // => 'hello barney!'
     *
     * // using a custom template delimiters
     * _.templateSettings = {
     *   'interpolate': /{{([\s\S]+?)}}/g
     * };
     *
     * _.template('hello {{ name }}!', { 'name': 'mustache' });
     * // => 'hello mustache!'
     *
     * // using the `imports` option to import jQuery
     * var list = '<% jq.each(people, function(name) { %><li><%- name %></li><% }); %>';
     * _.template(list, { 'people': ['fred', 'barney'] }, { 'imports': { 'jq': jQuery } });
     * // => '<li>fred</li><li>barney</li>'
     *
     * // using the `sourceURL` option to specify a custom sourceURL for the template
     * var compiled = _.template('hello <%= name %>', null, { 'sourceURL': '/basic/greeting.jst' });
     * compiled(data);
     * // => find the source of "greeting.jst" under the Sources tab or Resources panel of the web inspector
     *
     * // using the `variable` option to ensure a with-statement isn't used in the compiled template
     * var compiled = _.template('hi <%= data.name %>!', null, { 'variable': 'data' });
     * compiled.source;
     * // => function(data) {
     *   var __t, __p = '', __e = _.escape;
     *   __p += 'hi ' + ((__t = ( data.name )) == null ? '' : __t) + '!';
     *   return __p;
     * }
     *
     * // using the `source` property to inline compiled templates for meaningful
     * // line numbers in error messages and a stack trace
     * fs.writeFileSync(path.join(cwd, 'jst.js'), '\
     *   var JST = {\
     *     "main": ' + _.template(mainText).source + '\
     *   };\
     * ');
     */
    function template(text, data, options) {
      // based on John Resig's `tmpl` implementation
      // http://ejohn.org/blog/javascript-micro-templating/
      // and Laura Doktorova's doT.js
      // https://github.com/olado/doT
      var settings = lodash.templateSettings;
      text = String(text || '');

      // avoid missing dependencies when `iteratorTemplate` is not defined
      options = defaults({}, options, settings);

      var imports = defaults({}, options.imports, settings.imports),
          importsKeys = keys(imports),
          importsValues = values(imports);

      var isEvaluating,
          index = 0,
          interpolate = options.interpolate || reNoMatch,
          source = "__p += '";

      // compile the regexp to match each delimiter
      var reDelimiters = RegExp(
        (options.escape || reNoMatch).source + '|' +
        interpolate.source + '|' +
        (interpolate === reInterpolate ? reEsTemplate : reNoMatch).source + '|' +
        (options.evaluate || reNoMatch).source + '|$'
      , 'g');

      text.replace(reDelimiters, function(match, escapeValue, interpolateValue, esTemplateValue, evaluateValue, offset) {
        interpolateValue || (interpolateValue = esTemplateValue);

        // escape characters that cannot be included in string literals
        source += text.slice(index, offset).replace(reUnescapedString, escapeStringChar);

        // replace delimiters with snippets
        if (escapeValue) {
          source += "' +\n__e(" + escapeValue + ") +\n'";
        }
        if (evaluateValue) {
          isEvaluating = true;
          source += "';\n" + evaluateValue + ";\n__p += '";
        }
        if (interpolateValue) {
          source += "' +\n((__t = (" + interpolateValue + ")) == null ? '' : __t) +\n'";
        }
        index = offset + match.length;

        // the JS engine embedded in Adobe products requires returning the `match`
        // string in order to produce the correct `offset` value
        return match;
      });

      source += "';\n";

      // if `variable` is not specified, wrap a with-statement around the generated
      // code to add the data object to the top of the scope chain
      var variable = options.variable,
          hasVariable = variable;

      if (!hasVariable) {
        variable = 'obj';
        source = 'with (' + variable + ') {\n' + source + '\n}\n';
      }
      // cleanup code by stripping empty strings
      source = (isEvaluating ? source.replace(reEmptyStringLeading, '') : source)
        .replace(reEmptyStringMiddle, '$1')
        .replace(reEmptyStringTrailing, '$1;');

      // frame code as the function body
      source = 'function(' + variable + ') {\n' +
        (hasVariable ? '' : variable + ' || (' + variable + ' = {});\n') +
        "var __t, __p = '', __e = _.escape" +
        (isEvaluating
          ? ', __j = Array.prototype.join;\n' +
            "function print() { __p += __j.call(arguments, '') }\n"
          : ';\n'
        ) +
        source +
        'return __p\n}';

      // Use a sourceURL for easier debugging.
      // http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl
      var sourceURL = '\n/*\n//# sourceURL=' + (options.sourceURL || '/lodash/template/source[' + (templateCounter++) + ']') + '\n*/';

      try {
        var result = Function(importsKeys, 'return ' + source + sourceURL).apply(undefined, importsValues);
      } catch(e) {
        e.source = source;
        throw e;
      }
      if (data) {
        return result(data);
      }
      // provide the compiled function's source by its `toString` method, in
      // supported environments, or the `source` property as a convenience for
      // inlining compiled templates during the build process
      result.source = source;
      return result;
    }

    /**
     * Executes the callback `n` times, returning an array of the results
     * of each callback execution. The callback is bound to `thisArg` and invoked
     * with one argument; (index).
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {number} n The number of times to execute the callback.
     * @param {Function} callback The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns an array of the results of each `callback` execution.
     * @example
     *
     * var diceRolls = _.times(3, _.partial(_.random, 1, 6));
     * // => [3, 6, 4]
     *
     * _.times(3, function(n) { mage.castSpell(n); });
     * // => calls `mage.castSpell(n)` three times, passing `n` of `0`, `1`, and `2` respectively
     *
     * _.times(3, function(n) { this.cast(n); }, mage);
     * // => also calls `mage.castSpell(n)` three times
     */
    function times(n, callback, thisArg) {
      n = (n = +n) > -1 ? n : 0;
      var index = -1,
          result = Array(n);

      callback = baseCreateCallback(callback, thisArg, 1);
      while (++index < n) {
        result[index] = callback(index);
      }
      return result;
    }

    /**
     * The inverse of `_.escape` this method converts the HTML entities
     * `&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&#39;` in `string` to their
     * corresponding characters.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} string The string to unescape.
     * @returns {string} Returns the unescaped string.
     * @example
     *
     * _.unescape('Fred, Barney &amp; Pebbles');
     * // => 'Fred, Barney & Pebbles'
     */
    function unescape(string) {
      return string == null ? '' : String(string).replace(reEscapedHtml, unescapeHtmlChar);
    }

    /**
     * Generates a unique ID. If `prefix` is provided the ID will be appended to it.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} [prefix] The value to prefix the ID with.
     * @returns {string} Returns the unique ID.
     * @example
     *
     * _.uniqueId('contact_');
     * // => 'contact_104'
     *
     * _.uniqueId();
     * // => '105'
     */
    function uniqueId(prefix) {
      var id = ++idCounter;
      return String(prefix == null ? '' : prefix) + id;
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a `lodash` object that wraps the given value with explicit
     * method chaining enabled.
     *
     * @static
     * @memberOf _
     * @category Chaining
     * @param {*} value The value to wrap.
     * @returns {Object} Returns the wrapper object.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36 },
     *   { 'name': 'fred',    'age': 40 },
     *   { 'name': 'pebbles', 'age': 1 }
     * ];
     *
     * var youngest = _.chain(characters)
     *     .sortBy('age')
     *     .map(function(chr) { return chr.name + ' is ' + chr.age; })
     *     .first()
     *     .value();
     * // => 'pebbles is 1'
     */
    function chain(value) {
      value = new lodashWrapper(value);
      value.__chain__ = true;
      return value;
    }

    /**
     * Invokes `interceptor` with the `value` as the first argument and then
     * returns `value`. The purpose of this method is to "tap into" a method
     * chain in order to perform operations on intermediate results within
     * the chain.
     *
     * @static
     * @memberOf _
     * @category Chaining
     * @param {*} value The value to provide to `interceptor`.
     * @param {Function} interceptor The function to invoke.
     * @returns {*} Returns `value`.
     * @example
     *
     * _([1, 2, 3, 4])
     *  .tap(function(array) { array.pop(); })
     *  .reverse()
     *  .value();
     * // => [3, 2, 1]
     */
    function tap(value, interceptor) {
      interceptor(value);
      return value;
    }

    /**
     * Enables explicit method chaining on the wrapper object.
     *
     * @name chain
     * @memberOf _
     * @category Chaining
     * @returns {*} Returns the wrapper object.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // without explicit chaining
     * _(characters).first();
     * // => { 'name': 'barney', 'age': 36 }
     *
     * // with explicit chaining
     * _(characters).chain()
     *   .first()
     *   .pick('age')
     *   .value();
     * // => { 'age': 36 }
     */
    function wrapperChain() {
      this.__chain__ = true;
      return this;
    }

    /**
     * Produces the `toString` result of the wrapped value.
     *
     * @name toString
     * @memberOf _
     * @category Chaining
     * @returns {string} Returns the string result.
     * @example
     *
     * _([1, 2, 3]).toString();
     * // => '1,2,3'
     */
    function wrapperToString() {
      return String(this.__wrapped__);
    }

    /**
     * Extracts the wrapped value.
     *
     * @name valueOf
     * @memberOf _
     * @alias value
     * @category Chaining
     * @returns {*} Returns the wrapped value.
     * @example
     *
     * _([1, 2, 3]).valueOf();
     * // => [1, 2, 3]
     */
    function wrapperValueOf() {
      return this.__wrapped__;
    }

    /*--------------------------------------------------------------------------*/

    // add functions that return wrapped values when chaining
    lodash.after = after;
    lodash.assign = assign;
    lodash.at = at;
    lodash.bind = bind;
    lodash.bindAll = bindAll;
    lodash.bindKey = bindKey;
    lodash.chain = chain;
    lodash.compact = compact;
    lodash.compose = compose;
    lodash.constant = constant;
    lodash.countBy = countBy;
    lodash.create = create;
    lodash.createCallback = createCallback;
    lodash.curry = curry;
    lodash.debounce = debounce;
    lodash.defaults = defaults;
    lodash.defer = defer;
    lodash.delay = delay;
    lodash.difference = difference;
    lodash.filter = filter;
    lodash.flatten = flatten;
    lodash.forEach = forEach;
    lodash.forEachRight = forEachRight;
    lodash.forIn = forIn;
    lodash.forInRight = forInRight;
    lodash.forOwn = forOwn;
    lodash.forOwnRight = forOwnRight;
    lodash.functions = functions;
    lodash.groupBy = groupBy;
    lodash.indexBy = indexBy;
    lodash.initial = initial;
    lodash.intersection = intersection;
    lodash.invert = invert;
    lodash.invoke = invoke;
    lodash.keys = keys;
    lodash.map = map;
    lodash.mapValues = mapValues;
    lodash.max = max;
    lodash.memoize = memoize;
    lodash.merge = merge;
    lodash.min = min;
    lodash.omit = omit;
    lodash.once = once;
    lodash.pairs = pairs;
    lodash.partial = partial;
    lodash.partialRight = partialRight;
    lodash.pick = pick;
    lodash.pluck = pluck;
    lodash.property = property;
    lodash.pull = pull;
    lodash.range = range;
    lodash.reject = reject;
    lodash.remove = remove;
    lodash.rest = rest;
    lodash.shuffle = shuffle;
    lodash.sortBy = sortBy;
    lodash.tap = tap;
    lodash.throttle = throttle;
    lodash.times = times;
    lodash.toArray = toArray;
    lodash.transform = transform;
    lodash.union = union;
    lodash.uniq = uniq;
    lodash.values = values;
    lodash.where = where;
    lodash.without = without;
    lodash.wrap = wrap;
    lodash.xor = xor;
    lodash.zip = zip;
    lodash.zipObject = zipObject;

    // add aliases
    lodash.collect = map;
    lodash.drop = rest;
    lodash.each = forEach;
    lodash.eachRight = forEachRight;
    lodash.extend = assign;
    lodash.methods = functions;
    lodash.object = zipObject;
    lodash.select = filter;
    lodash.tail = rest;
    lodash.unique = uniq;
    lodash.unzip = zip;

    // add functions to `lodash.prototype`
    mixin(lodash);

    /*--------------------------------------------------------------------------*/

    // add functions that return unwrapped values when chaining
    lodash.clone = clone;
    lodash.cloneDeep = cloneDeep;
    lodash.contains = contains;
    lodash.escape = escape;
    lodash.every = every;
    lodash.find = find;
    lodash.findIndex = findIndex;
    lodash.findKey = findKey;
    lodash.findLast = findLast;
    lodash.findLastIndex = findLastIndex;
    lodash.findLastKey = findLastKey;
    lodash.has = has;
    lodash.identity = identity;
    lodash.indexOf = indexOf;
    lodash.isArguments = isArguments;
    lodash.isArray = isArray;
    lodash.isBoolean = isBoolean;
    lodash.isDate = isDate;
    lodash.isElement = isElement;
    lodash.isEmpty = isEmpty;
    lodash.isEqual = isEqual;
    lodash.isFinite = isFinite;
    lodash.isFunction = isFunction;
    lodash.isNaN = isNaN;
    lodash.isNull = isNull;
    lodash.isNumber = isNumber;
    lodash.isObject = isObject;
    lodash.isPlainObject = isPlainObject;
    lodash.isRegExp = isRegExp;
    lodash.isString = isString;
    lodash.isUndefined = isUndefined;
    lodash.lastIndexOf = lastIndexOf;
    lodash.mixin = mixin;
    lodash.noConflict = noConflict;
    lodash.noop = noop;
    lodash.now = now;
    lodash.parseInt = parseInt;
    lodash.random = random;
    lodash.reduce = reduce;
    lodash.reduceRight = reduceRight;
    lodash.result = result;
    lodash.runInContext = runInContext;
    lodash.size = size;
    lodash.some = some;
    lodash.sortedIndex = sortedIndex;
    lodash.template = template;
    lodash.unescape = unescape;
    lodash.uniqueId = uniqueId;

    // add aliases
    lodash.all = every;
    lodash.any = some;
    lodash.detect = find;
    lodash.findWhere = find;
    lodash.foldl = reduce;
    lodash.foldr = reduceRight;
    lodash.include = contains;
    lodash.inject = reduce;

    mixin(function() {
      var source = {}
      forOwn(lodash, function(func, methodName) {
        if (!lodash.prototype[methodName]) {
          source[methodName] = func;
        }
      });
      return source;
    }(), false);

    /*--------------------------------------------------------------------------*/

    // add functions capable of returning wrapped and unwrapped values when chaining
    lodash.first = first;
    lodash.last = last;
    lodash.sample = sample;

    // add aliases
    lodash.take = first;
    lodash.head = first;

    forOwn(lodash, function(func, methodName) {
      var callbackable = methodName !== 'sample';
      if (!lodash.prototype[methodName]) {
        lodash.prototype[methodName]= function(n, guard) {
          var chainAll = this.__chain__,
              result = func(this.__wrapped__, n, guard);

          return !chainAll && (n == null || (guard && !(callbackable && typeof n == 'function')))
            ? result
            : new lodashWrapper(result, chainAll);
        };
      }
    });

    /*--------------------------------------------------------------------------*/

    /**
     * The semantic version number.
     *
     * @static
     * @memberOf _
     * @type string
     */
    lodash.VERSION = '2.4.1';

    // add "Chaining" functions to the wrapper
    lodash.prototype.chain = wrapperChain;
    lodash.prototype.toString = wrapperToString;
    lodash.prototype.value = wrapperValueOf;
    lodash.prototype.valueOf = wrapperValueOf;

    // add `Array` functions that return unwrapped values
    forEach(['join', 'pop', 'shift'], function(methodName) {
      var func = arrayRef[methodName];
      lodash.prototype[methodName] = function() {
        var chainAll = this.__chain__,
            result = func.apply(this.__wrapped__, arguments);

        return chainAll
          ? new lodashWrapper(result, chainAll)
          : result;
      };
    });

    // add `Array` functions that return the existing wrapped value
    forEach(['push', 'reverse', 'sort', 'unshift'], function(methodName) {
      var func = arrayRef[methodName];
      lodash.prototype[methodName] = function() {
        func.apply(this.__wrapped__, arguments);
        return this;
      };
    });

    // add `Array` functions that return new wrapped values
    forEach(['concat', 'slice', 'splice'], function(methodName) {
      var func = arrayRef[methodName];
      lodash.prototype[methodName] = function() {
        return new lodashWrapper(func.apply(this.__wrapped__, arguments), this.__chain__);
      };
    });

    return lodash;
  }

  /*--------------------------------------------------------------------------*/

  // expose Lo-Dash
  var _ = runInContext();

  // some AMD build optimizers like r.js check for condition patterns like the following:
  if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
    // Expose Lo-Dash to the global object even when an AMD loader is present in
    // case Lo-Dash is loaded with a RequireJS shim config.
    // See http://requirejs.org/docs/api.html#config-shim
    root._ = _;

    // define as an anonymous module so, through path mapping, it can be
    // referenced as the "underscore" module
    define(function() {
      return _;
    });
  }
  // check for `exports` after `define` in case a build optimizer adds an `exports` object
  else if (freeExports && freeModule) {
    // in Node.js or RingoJS
    if (moduleExports) {
      (freeModule.exports = _)._ = _;
    }
    // in Narwhal or Rhino -require
    else {
      freeExports._ = _;
    }
  }
  else {
    // in a browser or Rhino
    root._ = _;
  }
}.call(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map.js":[function(require,module,exports){
/*
 * Copyright 2009-2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE.txt or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
exports.SourceMapGenerator = require('./source-map/source-map-generator').SourceMapGenerator;
exports.SourceMapConsumer = require('./source-map/source-map-consumer').SourceMapConsumer;
exports.SourceNode = require('./source-map/source-node').SourceNode;

},{"./source-map/source-map-consumer":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\source-map-consumer.js","./source-map/source-map-generator":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\source-map-generator.js","./source-map/source-node":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\source-node.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\array-set.js":[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var util = require('./util');

  /**
   * A data structure which is a combination of an array and a set. Adding a new
   * member is O(1), testing for membership is O(1), and finding the index of an
   * element is O(1). Removing elements from the set is not supported. Only
   * strings are supported for membership.
   */
  function ArraySet() {
    this._array = [];
    this._set = {};
  }

  /**
   * Static method for creating ArraySet instances from an existing array.
   */
  ArraySet.fromArray = function ArraySet_fromArray(aArray, aAllowDuplicates) {
    var set = new ArraySet();
    for (var i = 0, len = aArray.length; i < len; i++) {
      set.add(aArray[i], aAllowDuplicates);
    }
    return set;
  };

  /**
   * Add the given string to this set.
   *
   * @param String aStr
   */
  ArraySet.prototype.add = function ArraySet_add(aStr, aAllowDuplicates) {
    var isDuplicate = this.has(aStr);
    var idx = this._array.length;
    if (!isDuplicate || aAllowDuplicates) {
      this._array.push(aStr);
    }
    if (!isDuplicate) {
      this._set[util.toSetString(aStr)] = idx;
    }
  };

  /**
   * Is the given string a member of this set?
   *
   * @param String aStr
   */
  ArraySet.prototype.has = function ArraySet_has(aStr) {
    return Object.prototype.hasOwnProperty.call(this._set,
                                                util.toSetString(aStr));
  };

  /**
   * What is the index of the given string in the array?
   *
   * @param String aStr
   */
  ArraySet.prototype.indexOf = function ArraySet_indexOf(aStr) {
    if (this.has(aStr)) {
      return this._set[util.toSetString(aStr)];
    }
    throw new Error('"' + aStr + '" is not in the set.');
  };

  /**
   * What is the element at the given index?
   *
   * @param Number aIdx
   */
  ArraySet.prototype.at = function ArraySet_at(aIdx) {
    if (aIdx >= 0 && aIdx < this._array.length) {
      return this._array[aIdx];
    }
    throw new Error('No element indexed by ' + aIdx);
  };

  /**
   * Returns the array representation of this set (which has the proper indices
   * indicated by indexOf). Note that this is a copy of the internal array used
   * for storing the members so that no one can mess with internal state.
   */
  ArraySet.prototype.toArray = function ArraySet_toArray() {
    return this._array.slice();
  };

  exports.ArraySet = ArraySet;

});

},{"./util":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\util.js","amdefine":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\node_modules\\amdefine\\amdefine.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\base64-vlq.js":[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 *
 * Based on the Base 64 VLQ implementation in Closure Compiler:
 * https://code.google.com/p/closure-compiler/source/browse/trunk/src/com/google/debugging/sourcemap/Base64VLQ.java
 *
 * Copyright 2011 The Closure Compiler Authors. All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *  * Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above
 *    copyright notice, this list of conditions and the following
 *    disclaimer in the documentation and/or other materials provided
 *    with the distribution.
 *  * Neither the name of Google Inc. nor the names of its
 *    contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var base64 = require('./base64');

  // A single base 64 digit can contain 6 bits of data. For the base 64 variable
  // length quantities we use in the source map spec, the first bit is the sign,
  // the next four bits are the actual value, and the 6th bit is the
  // continuation bit. The continuation bit tells us whether there are more
  // digits in this value following this digit.
  //
  //   Continuation
  //   |    Sign
  //   |    |
  //   V    V
  //   101011

  var VLQ_BASE_SHIFT = 5;

  // binary: 100000
  var VLQ_BASE = 1 << VLQ_BASE_SHIFT;

  // binary: 011111
  var VLQ_BASE_MASK = VLQ_BASE - 1;

  // binary: 100000
  var VLQ_CONTINUATION_BIT = VLQ_BASE;

  /**
   * Converts from a two-complement value to a value where the sign bit is
   * is placed in the least significant bit.  For example, as decimals:
   *   1 becomes 2 (10 binary), -1 becomes 3 (11 binary)
   *   2 becomes 4 (100 binary), -2 becomes 5 (101 binary)
   */
  function toVLQSigned(aValue) {
    return aValue < 0
      ? ((-aValue) << 1) + 1
      : (aValue << 1) + 0;
  }

  /**
   * Converts to a two-complement value from a value where the sign bit is
   * is placed in the least significant bit.  For example, as decimals:
   *   2 (10 binary) becomes 1, 3 (11 binary) becomes -1
   *   4 (100 binary) becomes 2, 5 (101 binary) becomes -2
   */
  function fromVLQSigned(aValue) {
    var isNegative = (aValue & 1) === 1;
    var shifted = aValue >> 1;
    return isNegative
      ? -shifted
      : shifted;
  }

  /**
   * Returns the base 64 VLQ encoded value.
   */
  exports.encode = function base64VLQ_encode(aValue) {
    var encoded = "";
    var digit;

    var vlq = toVLQSigned(aValue);

    do {
      digit = vlq & VLQ_BASE_MASK;
      vlq >>>= VLQ_BASE_SHIFT;
      if (vlq > 0) {
        // There are still more digits in this value, so we must make sure the
        // continuation bit is marked.
        digit |= VLQ_CONTINUATION_BIT;
      }
      encoded += base64.encode(digit);
    } while (vlq > 0);

    return encoded;
  };

  /**
   * Decodes the next base 64 VLQ value from the given string and returns the
   * value and the rest of the string.
   */
  exports.decode = function base64VLQ_decode(aStr) {
    var i = 0;
    var strLen = aStr.length;
    var result = 0;
    var shift = 0;
    var continuation, digit;

    do {
      if (i >= strLen) {
        throw new Error("Expected more digits in base 64 VLQ value.");
      }
      digit = base64.decode(aStr.charAt(i++));
      continuation = !!(digit & VLQ_CONTINUATION_BIT);
      digit &= VLQ_BASE_MASK;
      result = result + (digit << shift);
      shift += VLQ_BASE_SHIFT;
    } while (continuation);

    return {
      value: fromVLQSigned(result),
      rest: aStr.slice(i)
    };
  };

});

},{"./base64":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\base64.js","amdefine":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\node_modules\\amdefine\\amdefine.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\base64.js":[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var charToIntMap = {};
  var intToCharMap = {};

  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    .split('')
    .forEach(function (ch, index) {
      charToIntMap[ch] = index;
      intToCharMap[index] = ch;
    });

  /**
   * Encode an integer in the range of 0 to 63 to a single base 64 digit.
   */
  exports.encode = function base64_encode(aNumber) {
    if (aNumber in intToCharMap) {
      return intToCharMap[aNumber];
    }
    throw new TypeError("Must be between 0 and 63: " + aNumber);
  };

  /**
   * Decode a single base 64 digit to an integer.
   */
  exports.decode = function base64_decode(aChar) {
    if (aChar in charToIntMap) {
      return charToIntMap[aChar];
    }
    throw new TypeError("Not a valid base 64 digit: " + aChar);
  };

});

},{"amdefine":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\node_modules\\amdefine\\amdefine.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\binary-search.js":[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  /**
   * Recursive implementation of binary search.
   *
   * @param aLow Indices here and lower do not contain the needle.
   * @param aHigh Indices here and higher do not contain the needle.
   * @param aNeedle The element being searched for.
   * @param aHaystack The non-empty array being searched.
   * @param aCompare Function which takes two elements and returns -1, 0, or 1.
   */
  function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare) {
    // This function terminates when one of the following is true:
    //
    //   1. We find the exact element we are looking for.
    //
    //   2. We did not find the exact element, but we can return the next
    //      closest element that is less than that element.
    //
    //   3. We did not find the exact element, and there is no next-closest
    //      element which is less than the one we are searching for, so we
    //      return null.
    var mid = Math.floor((aHigh - aLow) / 2) + aLow;
    var cmp = aCompare(aNeedle, aHaystack[mid], true);
    if (cmp === 0) {
      // Found the element we are looking for.
      return aHaystack[mid];
    }
    else if (cmp > 0) {
      // aHaystack[mid] is greater than our needle.
      if (aHigh - mid > 1) {
        // The element is in the upper half.
        return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare);
      }
      // We did not find an exact match, return the next closest one
      // (termination case 2).
      return aHaystack[mid];
    }
    else {
      // aHaystack[mid] is less than our needle.
      if (mid - aLow > 1) {
        // The element is in the lower half.
        return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare);
      }
      // The exact needle element was not found in this haystack. Determine if
      // we are in termination case (2) or (3) and return the appropriate thing.
      return aLow < 0
        ? null
        : aHaystack[aLow];
    }
  }

  /**
   * This is an implementation of binary search which will always try and return
   * the next lowest value checked if there is no exact hit. This is because
   * mappings between original and generated line/col pairs are single points,
   * and there is an implicit region between each of them, so a miss just means
   * that you aren't on the very start of a region.
   *
   * @param aNeedle The element you are looking for.
   * @param aHaystack The array that is being searched.
   * @param aCompare A function which takes the needle and an element in the
   *     array and returns -1, 0, or 1 depending on whether the needle is less
   *     than, equal to, or greater than the element, respectively.
   */
  exports.search = function search(aNeedle, aHaystack, aCompare) {
    return aHaystack.length > 0
      ? recursiveSearch(-1, aHaystack.length, aNeedle, aHaystack, aCompare)
      : null;
  };

});

},{"amdefine":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\node_modules\\amdefine\\amdefine.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\source-map-consumer.js":[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var util = require('./util');
  var binarySearch = require('./binary-search');
  var ArraySet = require('./array-set').ArraySet;
  var base64VLQ = require('./base64-vlq');

  /**
   * A SourceMapConsumer instance represents a parsed source map which we can
   * query for information about the original file positions by giving it a file
   * position in the generated source.
   *
   * The only parameter is the raw source map (either as a JSON string, or
   * already parsed to an object). According to the spec, source maps have the
   * following attributes:
   *
   *   - version: Which version of the source map spec this map is following.
   *   - sources: An array of URLs to the original source files.
   *   - names: An array of identifiers which can be referrenced by individual mappings.
   *   - sourceRoot: Optional. The URL root from which all sources are relative.
   *   - sourcesContent: Optional. An array of contents of the original source files.
   *   - mappings: A string of base64 VLQs which contain the actual mappings.
   *   - file: Optional. The generated file this source map is associated with.
   *
   * Here is an example source map, taken from the source map spec[0]:
   *
   *     {
   *       version : 3,
   *       file: "out.js",
   *       sourceRoot : "",
   *       sources: ["foo.js", "bar.js"],
   *       names: ["src", "maps", "are", "fun"],
   *       mappings: "AA,AB;;ABCDE;"
   *     }
   *
   * [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit?pli=1#
   */
  function SourceMapConsumer(aSourceMap) {
    var sourceMap = aSourceMap;
    if (typeof aSourceMap === 'string') {
      sourceMap = JSON.parse(aSourceMap.replace(/^\)\]\}'/, ''));
    }

    var version = util.getArg(sourceMap, 'version');
    var sources = util.getArg(sourceMap, 'sources');
    // Sass 3.3 leaves out the 'names' array, so we deviate from the spec (which
    // requires the array) to play nice here.
    var names = util.getArg(sourceMap, 'names', []);
    var sourceRoot = util.getArg(sourceMap, 'sourceRoot', null);
    var sourcesContent = util.getArg(sourceMap, 'sourcesContent', null);
    var mappings = util.getArg(sourceMap, 'mappings');
    var file = util.getArg(sourceMap, 'file', null);

    // Once again, Sass deviates from the spec and supplies the version as a
    // string rather than a number, so we use loose equality checking here.
    if (version != this._version) {
      throw new Error('Unsupported version: ' + version);
    }

    // Pass `true` below to allow duplicate names and sources. While source maps
    // are intended to be compressed and deduplicated, the TypeScript compiler
    // sometimes generates source maps with duplicates in them. See Github issue
    // #72 and bugzil.la/889492.
    this._names = ArraySet.fromArray(names, true);
    this._sources = ArraySet.fromArray(sources, true);

    this.sourceRoot = sourceRoot;
    this.sourcesContent = sourcesContent;
    this._mappings = mappings;
    this.file = file;
  }

  /**
   * Create a SourceMapConsumer from a SourceMapGenerator.
   *
   * @param SourceMapGenerator aSourceMap
   *        The source map that will be consumed.
   * @returns SourceMapConsumer
   */
  SourceMapConsumer.fromSourceMap =
    function SourceMapConsumer_fromSourceMap(aSourceMap) {
      var smc = Object.create(SourceMapConsumer.prototype);

      smc._names = ArraySet.fromArray(aSourceMap._names.toArray(), true);
      smc._sources = ArraySet.fromArray(aSourceMap._sources.toArray(), true);
      smc.sourceRoot = aSourceMap._sourceRoot;
      smc.sourcesContent = aSourceMap._generateSourcesContent(smc._sources.toArray(),
                                                              smc.sourceRoot);
      smc.file = aSourceMap._file;

      smc.__generatedMappings = aSourceMap._mappings.slice()
        .sort(util.compareByGeneratedPositions);
      smc.__originalMappings = aSourceMap._mappings.slice()
        .sort(util.compareByOriginalPositions);

      return smc;
    };

  /**
   * The version of the source mapping spec that we are consuming.
   */
  SourceMapConsumer.prototype._version = 3;

  /**
   * The list of original sources.
   */
  Object.defineProperty(SourceMapConsumer.prototype, 'sources', {
    get: function () {
      return this._sources.toArray().map(function (s) {
        return this.sourceRoot ? util.join(this.sourceRoot, s) : s;
      }, this);
    }
  });

  // `__generatedMappings` and `__originalMappings` are arrays that hold the
  // parsed mapping coordinates from the source map's "mappings" attribute. They
  // are lazily instantiated, accessed via the `_generatedMappings` and
  // `_originalMappings` getters respectively, and we only parse the mappings
  // and create these arrays once queried for a source location. We jump through
  // these hoops because there can be many thousands of mappings, and parsing
  // them is expensive, so we only want to do it if we must.
  //
  // Each object in the arrays is of the form:
  //
  //     {
  //       generatedLine: The line number in the generated code,
  //       generatedColumn: The column number in the generated code,
  //       source: The path to the original source file that generated this
  //               chunk of code,
  //       originalLine: The line number in the original source that
  //                     corresponds to this chunk of generated code,
  //       originalColumn: The column number in the original source that
  //                       corresponds to this chunk of generated code,
  //       name: The name of the original symbol which generated this chunk of
  //             code.
  //     }
  //
  // All properties except for `generatedLine` and `generatedColumn` can be
  // `null`.
  //
  // `_generatedMappings` is ordered by the generated positions.
  //
  // `_originalMappings` is ordered by the original positions.

  SourceMapConsumer.prototype.__generatedMappings = null;
  Object.defineProperty(SourceMapConsumer.prototype, '_generatedMappings', {
    get: function () {
      if (!this.__generatedMappings) {
        this.__generatedMappings = [];
        this.__originalMappings = [];
        this._parseMappings(this._mappings, this.sourceRoot);
      }

      return this.__generatedMappings;
    }
  });

  SourceMapConsumer.prototype.__originalMappings = null;
  Object.defineProperty(SourceMapConsumer.prototype, '_originalMappings', {
    get: function () {
      if (!this.__originalMappings) {
        this.__generatedMappings = [];
        this.__originalMappings = [];
        this._parseMappings(this._mappings, this.sourceRoot);
      }

      return this.__originalMappings;
    }
  });

  /**
   * Parse the mappings in a string in to a data structure which we can easily
   * query (the ordered arrays in the `this.__generatedMappings` and
   * `this.__originalMappings` properties).
   */
  SourceMapConsumer.prototype._parseMappings =
    function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
      var generatedLine = 1;
      var previousGeneratedColumn = 0;
      var previousOriginalLine = 0;
      var previousOriginalColumn = 0;
      var previousSource = 0;
      var previousName = 0;
      var mappingSeparator = /^[,;]/;
      var str = aStr;
      var mapping;
      var temp;

      while (str.length > 0) {
        if (str.charAt(0) === ';') {
          generatedLine++;
          str = str.slice(1);
          previousGeneratedColumn = 0;
        }
        else if (str.charAt(0) === ',') {
          str = str.slice(1);
        }
        else {
          mapping = {};
          mapping.generatedLine = generatedLine;

          // Generated column.
          temp = base64VLQ.decode(str);
          mapping.generatedColumn = previousGeneratedColumn + temp.value;
          previousGeneratedColumn = mapping.generatedColumn;
          str = temp.rest;

          if (str.length > 0 && !mappingSeparator.test(str.charAt(0))) {
            // Original source.
            temp = base64VLQ.decode(str);
            mapping.source = this._sources.at(previousSource + temp.value);
            previousSource += temp.value;
            str = temp.rest;
            if (str.length === 0 || mappingSeparator.test(str.charAt(0))) {
              throw new Error('Found a source, but no line and column');
            }

            // Original line.
            temp = base64VLQ.decode(str);
            mapping.originalLine = previousOriginalLine + temp.value;
            previousOriginalLine = mapping.originalLine;
            // Lines are stored 0-based
            mapping.originalLine += 1;
            str = temp.rest;
            if (str.length === 0 || mappingSeparator.test(str.charAt(0))) {
              throw new Error('Found a source and line, but no column');
            }

            // Original column.
            temp = base64VLQ.decode(str);
            mapping.originalColumn = previousOriginalColumn + temp.value;
            previousOriginalColumn = mapping.originalColumn;
            str = temp.rest;

            if (str.length > 0 && !mappingSeparator.test(str.charAt(0))) {
              // Original name.
              temp = base64VLQ.decode(str);
              mapping.name = this._names.at(previousName + temp.value);
              previousName += temp.value;
              str = temp.rest;
            }
          }

          this.__generatedMappings.push(mapping);
          if (typeof mapping.originalLine === 'number') {
            this.__originalMappings.push(mapping);
          }
        }
      }

      this.__generatedMappings.sort(util.compareByGeneratedPositions);
      this.__originalMappings.sort(util.compareByOriginalPositions);
    };

  /**
   * Find the mapping that best matches the hypothetical "needle" mapping that
   * we are searching for in the given "haystack" of mappings.
   */
  SourceMapConsumer.prototype._findMapping =
    function SourceMapConsumer_findMapping(aNeedle, aMappings, aLineName,
                                           aColumnName, aComparator) {
      // To return the position we are searching for, we must first find the
      // mapping for the given position and then return the opposite position it
      // points to. Because the mappings are sorted, we can use binary search to
      // find the best mapping.

      if (aNeedle[aLineName] <= 0) {
        throw new TypeError('Line must be greater than or equal to 1, got '
                            + aNeedle[aLineName]);
      }
      if (aNeedle[aColumnName] < 0) {
        throw new TypeError('Column must be greater than or equal to 0, got '
                            + aNeedle[aColumnName]);
      }

      return binarySearch.search(aNeedle, aMappings, aComparator);
    };

  /**
   * Returns the original source, line, and column information for the generated
   * source's line and column positions provided. The only argument is an object
   * with the following properties:
   *
   *   - line: The line number in the generated source.
   *   - column: The column number in the generated source.
   *
   * and an object is returned with the following properties:
   *
   *   - source: The original source file, or null.
   *   - line: The line number in the original source, or null.
   *   - column: The column number in the original source, or null.
   *   - name: The original identifier, or null.
   */
  SourceMapConsumer.prototype.originalPositionFor =
    function SourceMapConsumer_originalPositionFor(aArgs) {
      var needle = {
        generatedLine: util.getArg(aArgs, 'line'),
        generatedColumn: util.getArg(aArgs, 'column')
      };

      var mapping = this._findMapping(needle,
                                      this._generatedMappings,
                                      "generatedLine",
                                      "generatedColumn",
                                      util.compareByGeneratedPositions);

      if (mapping && mapping.generatedLine === needle.generatedLine) {
        var source = util.getArg(mapping, 'source', null);
        if (source && this.sourceRoot) {
          source = util.join(this.sourceRoot, source);
        }
        return {
          source: source,
          line: util.getArg(mapping, 'originalLine', null),
          column: util.getArg(mapping, 'originalColumn', null),
          name: util.getArg(mapping, 'name', null)
        };
      }

      return {
        source: null,
        line: null,
        column: null,
        name: null
      };
    };

  /**
   * Returns the original source content. The only argument is the url of the
   * original source file. Returns null if no original source content is
   * availible.
   */
  SourceMapConsumer.prototype.sourceContentFor =
    function SourceMapConsumer_sourceContentFor(aSource) {
      if (!this.sourcesContent) {
        return null;
      }

      if (this.sourceRoot) {
        aSource = util.relative(this.sourceRoot, aSource);
      }

      if (this._sources.has(aSource)) {
        return this.sourcesContent[this._sources.indexOf(aSource)];
      }

      var url;
      if (this.sourceRoot
          && (url = util.urlParse(this.sourceRoot))) {
        // XXX: file:// URIs and absolute paths lead to unexpected behavior for
        // many users. We can help them out when they expect file:// URIs to
        // behave like it would if they were running a local HTTP server. See
        // https://bugzilla.mozilla.org/show_bug.cgi?id=885597.
        var fileUriAbsPath = aSource.replace(/^file:\/\//, "");
        if (url.scheme == "file"
            && this._sources.has(fileUriAbsPath)) {
          return this.sourcesContent[this._sources.indexOf(fileUriAbsPath)]
        }

        if ((!url.path || url.path == "/")
            && this._sources.has("/" + aSource)) {
          return this.sourcesContent[this._sources.indexOf("/" + aSource)];
        }
      }

      throw new Error('"' + aSource + '" is not in the SourceMap.');
    };

  /**
   * Returns the generated line and column information for the original source,
   * line, and column positions provided. The only argument is an object with
   * the following properties:
   *
   *   - source: The filename of the original source.
   *   - line: The line number in the original source.
   *   - column: The column number in the original source.
   *
   * and an object is returned with the following properties:
   *
   *   - line: The line number in the generated source, or null.
   *   - column: The column number in the generated source, or null.
   */
  SourceMapConsumer.prototype.generatedPositionFor =
    function SourceMapConsumer_generatedPositionFor(aArgs) {
      var needle = {
        source: util.getArg(aArgs, 'source'),
        originalLine: util.getArg(aArgs, 'line'),
        originalColumn: util.getArg(aArgs, 'column')
      };

      if (this.sourceRoot) {
        needle.source = util.relative(this.sourceRoot, needle.source);
      }

      var mapping = this._findMapping(needle,
                                      this._originalMappings,
                                      "originalLine",
                                      "originalColumn",
                                      util.compareByOriginalPositions);

      if (mapping) {
        return {
          line: util.getArg(mapping, 'generatedLine', null),
          column: util.getArg(mapping, 'generatedColumn', null)
        };
      }

      return {
        line: null,
        column: null
      };
    };

  SourceMapConsumer.GENERATED_ORDER = 1;
  SourceMapConsumer.ORIGINAL_ORDER = 2;

  /**
   * Iterate over each mapping between an original source/line/column and a
   * generated line/column in this source map.
   *
   * @param Function aCallback
   *        The function that is called with each mapping.
   * @param Object aContext
   *        Optional. If specified, this object will be the value of `this` every
   *        time that `aCallback` is called.
   * @param aOrder
   *        Either `SourceMapConsumer.GENERATED_ORDER` or
   *        `SourceMapConsumer.ORIGINAL_ORDER`. Specifies whether you want to
   *        iterate over the mappings sorted by the generated file's line/column
   *        order or the original's source/line/column order, respectively. Defaults to
   *        `SourceMapConsumer.GENERATED_ORDER`.
   */
  SourceMapConsumer.prototype.eachMapping =
    function SourceMapConsumer_eachMapping(aCallback, aContext, aOrder) {
      var context = aContext || null;
      var order = aOrder || SourceMapConsumer.GENERATED_ORDER;

      var mappings;
      switch (order) {
      case SourceMapConsumer.GENERATED_ORDER:
        mappings = this._generatedMappings;
        break;
      case SourceMapConsumer.ORIGINAL_ORDER:
        mappings = this._originalMappings;
        break;
      default:
        throw new Error("Unknown order of iteration.");
      }

      var sourceRoot = this.sourceRoot;
      mappings.map(function (mapping) {
        var source = mapping.source;
        if (source && sourceRoot) {
          source = util.join(sourceRoot, source);
        }
        return {
          source: source,
          generatedLine: mapping.generatedLine,
          generatedColumn: mapping.generatedColumn,
          originalLine: mapping.originalLine,
          originalColumn: mapping.originalColumn,
          name: mapping.name
        };
      }).forEach(aCallback, context);
    };

  exports.SourceMapConsumer = SourceMapConsumer;

});

},{"./array-set":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\array-set.js","./base64-vlq":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\base64-vlq.js","./binary-search":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\binary-search.js","./util":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\util.js","amdefine":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\node_modules\\amdefine\\amdefine.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\source-map-generator.js":[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var base64VLQ = require('./base64-vlq');
  var util = require('./util');
  var ArraySet = require('./array-set').ArraySet;

  /**
   * An instance of the SourceMapGenerator represents a source map which is
   * being built incrementally. You may pass an object with the following
   * properties:
   *
   *   - file: The filename of the generated source.
   *   - sourceRoot: A root for all relative URLs in this source map.
   */
  function SourceMapGenerator(aArgs) {
    if (!aArgs) {
      aArgs = {};
    }
    this._file = util.getArg(aArgs, 'file', null);
    this._sourceRoot = util.getArg(aArgs, 'sourceRoot', null);
    this._sources = new ArraySet();
    this._names = new ArraySet();
    this._mappings = [];
    this._sourcesContents = null;
  }

  SourceMapGenerator.prototype._version = 3;

  /**
   * Creates a new SourceMapGenerator based on a SourceMapConsumer
   *
   * @param aSourceMapConsumer The SourceMap.
   */
  SourceMapGenerator.fromSourceMap =
    function SourceMapGenerator_fromSourceMap(aSourceMapConsumer) {
      var sourceRoot = aSourceMapConsumer.sourceRoot;
      var generator = new SourceMapGenerator({
        file: aSourceMapConsumer.file,
        sourceRoot: sourceRoot
      });
      aSourceMapConsumer.eachMapping(function (mapping) {
        var newMapping = {
          generated: {
            line: mapping.generatedLine,
            column: mapping.generatedColumn
          }
        };

        if (mapping.source) {
          newMapping.source = mapping.source;
          if (sourceRoot) {
            newMapping.source = util.relative(sourceRoot, newMapping.source);
          }

          newMapping.original = {
            line: mapping.originalLine,
            column: mapping.originalColumn
          };

          if (mapping.name) {
            newMapping.name = mapping.name;
          }
        }

        generator.addMapping(newMapping);
      });
      aSourceMapConsumer.sources.forEach(function (sourceFile) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content) {
          generator.setSourceContent(sourceFile, content);
        }
      });
      return generator;
    };

  /**
   * Add a single mapping from original source line and column to the generated
   * source's line and column for this source map being created. The mapping
   * object should have the following properties:
   *
   *   - generated: An object with the generated line and column positions.
   *   - original: An object with the original line and column positions.
   *   - source: The original source file (relative to the sourceRoot).
   *   - name: An optional original token name for this mapping.
   */
  SourceMapGenerator.prototype.addMapping =
    function SourceMapGenerator_addMapping(aArgs) {
      var generated = util.getArg(aArgs, 'generated');
      var original = util.getArg(aArgs, 'original', null);
      var source = util.getArg(aArgs, 'source', null);
      var name = util.getArg(aArgs, 'name', null);

      this._validateMapping(generated, original, source, name);

      if (source && !this._sources.has(source)) {
        this._sources.add(source);
      }

      if (name && !this._names.has(name)) {
        this._names.add(name);
      }

      this._mappings.push({
        generatedLine: generated.line,
        generatedColumn: generated.column,
        originalLine: original != null && original.line,
        originalColumn: original != null && original.column,
        source: source,
        name: name
      });
    };

  /**
   * Set the source content for a source file.
   */
  SourceMapGenerator.prototype.setSourceContent =
    function SourceMapGenerator_setSourceContent(aSourceFile, aSourceContent) {
      var source = aSourceFile;
      if (this._sourceRoot) {
        source = util.relative(this._sourceRoot, source);
      }

      if (aSourceContent !== null) {
        // Add the source content to the _sourcesContents map.
        // Create a new _sourcesContents map if the property is null.
        if (!this._sourcesContents) {
          this._sourcesContents = {};
        }
        this._sourcesContents[util.toSetString(source)] = aSourceContent;
      } else {
        // Remove the source file from the _sourcesContents map.
        // If the _sourcesContents map is empty, set the property to null.
        delete this._sourcesContents[util.toSetString(source)];
        if (Object.keys(this._sourcesContents).length === 0) {
          this._sourcesContents = null;
        }
      }
    };

  /**
   * Applies the mappings of a sub-source-map for a specific source file to the
   * source map being generated. Each mapping to the supplied source file is
   * rewritten using the supplied source map. Note: The resolution for the
   * resulting mappings is the minimium of this map and the supplied map.
   *
   * @param aSourceMapConsumer The source map to be applied.
   * @param aSourceFile Optional. The filename of the source file.
   *        If omitted, SourceMapConsumer's file property will be used.
   * @param aSourceMapPath Optional. The dirname of the path to the source map
   *        to be applied. If relative, it is relative to the SourceMapConsumer.
   *        This parameter is needed when the two source maps aren't in the same
   *        directory, and the source map to be applied contains relative source
   *        paths. If so, those relative source paths need to be rewritten
   *        relative to the SourceMapGenerator.
   */
  SourceMapGenerator.prototype.applySourceMap =
    function SourceMapGenerator_applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
      // If aSourceFile is omitted, we will use the file property of the SourceMap
      if (!aSourceFile) {
        if (!aSourceMapConsumer.file) {
          throw new Error(
            'SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, ' +
            'or the source map\'s "file" property. Both were omitted.'
          );
        }
        aSourceFile = aSourceMapConsumer.file;
      }
      var sourceRoot = this._sourceRoot;
      // Make "aSourceFile" relative if an absolute Url is passed.
      if (sourceRoot) {
        aSourceFile = util.relative(sourceRoot, aSourceFile);
      }
      // Applying the SourceMap can add and remove items from the sources and
      // the names array.
      var newSources = new ArraySet();
      var newNames = new ArraySet();

      // Find mappings for the "aSourceFile"
      this._mappings.forEach(function (mapping) {
        if (mapping.source === aSourceFile && mapping.originalLine) {
          // Check if it can be mapped by the source map, then update the mapping.
          var original = aSourceMapConsumer.originalPositionFor({
            line: mapping.originalLine,
            column: mapping.originalColumn
          });
          if (original.source !== null) {
            // Copy mapping
            mapping.source = original.source;
            if (aSourceMapPath) {
              mapping.source = util.join(aSourceMapPath, mapping.source)
            }
            if (sourceRoot) {
              mapping.source = util.relative(sourceRoot, mapping.source);
            }
            mapping.originalLine = original.line;
            mapping.originalColumn = original.column;
            if (original.name !== null && mapping.name !== null) {
              // Only use the identifier name if it's an identifier
              // in both SourceMaps
              mapping.name = original.name;
            }
          }
        }

        var source = mapping.source;
        if (source && !newSources.has(source)) {
          newSources.add(source);
        }

        var name = mapping.name;
        if (name && !newNames.has(name)) {
          newNames.add(name);
        }

      }, this);
      this._sources = newSources;
      this._names = newNames;

      // Copy sourcesContents of applied map.
      aSourceMapConsumer.sources.forEach(function (sourceFile) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content) {
          if (aSourceMapPath) {
            sourceFile = util.join(aSourceMapPath, sourceFile);
          }
          if (sourceRoot) {
            sourceFile = util.relative(sourceRoot, sourceFile);
          }
          this.setSourceContent(sourceFile, content);
        }
      }, this);
    };

  /**
   * A mapping can have one of the three levels of data:
   *
   *   1. Just the generated position.
   *   2. The Generated position, original position, and original source.
   *   3. Generated and original position, original source, as well as a name
   *      token.
   *
   * To maintain consistency, we validate that any new mapping being added falls
   * in to one of these categories.
   */
  SourceMapGenerator.prototype._validateMapping =
    function SourceMapGenerator_validateMapping(aGenerated, aOriginal, aSource,
                                                aName) {
      if (aGenerated && 'line' in aGenerated && 'column' in aGenerated
          && aGenerated.line > 0 && aGenerated.column >= 0
          && !aOriginal && !aSource && !aName) {
        // Case 1.
        return;
      }
      else if (aGenerated && 'line' in aGenerated && 'column' in aGenerated
               && aOriginal && 'line' in aOriginal && 'column' in aOriginal
               && aGenerated.line > 0 && aGenerated.column >= 0
               && aOriginal.line > 0 && aOriginal.column >= 0
               && aSource) {
        // Cases 2 and 3.
        return;
      }
      else {
        throw new Error('Invalid mapping: ' + JSON.stringify({
          generated: aGenerated,
          source: aSource,
          original: aOriginal,
          name: aName
        }));
      }
    };

  /**
   * Serialize the accumulated mappings in to the stream of base 64 VLQs
   * specified by the source map format.
   */
  SourceMapGenerator.prototype._serializeMappings =
    function SourceMapGenerator_serializeMappings() {
      var previousGeneratedColumn = 0;
      var previousGeneratedLine = 1;
      var previousOriginalColumn = 0;
      var previousOriginalLine = 0;
      var previousName = 0;
      var previousSource = 0;
      var result = '';
      var mapping;

      // The mappings must be guaranteed to be in sorted order before we start
      // serializing them or else the generated line numbers (which are defined
      // via the ';' separators) will be all messed up. Note: it might be more
      // performant to maintain the sorting as we insert them, rather than as we
      // serialize them, but the big O is the same either way.
      this._mappings.sort(util.compareByGeneratedPositions);

      for (var i = 0, len = this._mappings.length; i < len; i++) {
        mapping = this._mappings[i];

        if (mapping.generatedLine !== previousGeneratedLine) {
          previousGeneratedColumn = 0;
          while (mapping.generatedLine !== previousGeneratedLine) {
            result += ';';
            previousGeneratedLine++;
          }
        }
        else {
          if (i > 0) {
            if (!util.compareByGeneratedPositions(mapping, this._mappings[i - 1])) {
              continue;
            }
            result += ',';
          }
        }

        result += base64VLQ.encode(mapping.generatedColumn
                                   - previousGeneratedColumn);
        previousGeneratedColumn = mapping.generatedColumn;

        if (mapping.source) {
          result += base64VLQ.encode(this._sources.indexOf(mapping.source)
                                     - previousSource);
          previousSource = this._sources.indexOf(mapping.source);

          // lines are stored 0-based in SourceMap spec version 3
          result += base64VLQ.encode(mapping.originalLine - 1
                                     - previousOriginalLine);
          previousOriginalLine = mapping.originalLine - 1;

          result += base64VLQ.encode(mapping.originalColumn
                                     - previousOriginalColumn);
          previousOriginalColumn = mapping.originalColumn;

          if (mapping.name) {
            result += base64VLQ.encode(this._names.indexOf(mapping.name)
                                       - previousName);
            previousName = this._names.indexOf(mapping.name);
          }
        }
      }

      return result;
    };

  SourceMapGenerator.prototype._generateSourcesContent =
    function SourceMapGenerator_generateSourcesContent(aSources, aSourceRoot) {
      return aSources.map(function (source) {
        if (!this._sourcesContents) {
          return null;
        }
        if (aSourceRoot) {
          source = util.relative(aSourceRoot, source);
        }
        var key = util.toSetString(source);
        return Object.prototype.hasOwnProperty.call(this._sourcesContents,
                                                    key)
          ? this._sourcesContents[key]
          : null;
      }, this);
    };

  /**
   * Externalize the source map.
   */
  SourceMapGenerator.prototype.toJSON =
    function SourceMapGenerator_toJSON() {
      var map = {
        version: this._version,
        file: this._file,
        sources: this._sources.toArray(),
        names: this._names.toArray(),
        mappings: this._serializeMappings()
      };
      if (this._sourceRoot) {
        map.sourceRoot = this._sourceRoot;
      }
      if (this._sourcesContents) {
        map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot);
      }

      return map;
    };

  /**
   * Render the source map being generated to a string.
   */
  SourceMapGenerator.prototype.toString =
    function SourceMapGenerator_toString() {
      return JSON.stringify(this);
    };

  exports.SourceMapGenerator = SourceMapGenerator;

});

},{"./array-set":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\array-set.js","./base64-vlq":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\base64-vlq.js","./util":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\util.js","amdefine":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\node_modules\\amdefine\\amdefine.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\source-node.js":[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var SourceMapGenerator = require('./source-map-generator').SourceMapGenerator;
  var util = require('./util');

  // Matches a Windows-style `\r\n` newline or a `\n` newline used by all other
  // operating systems these days (capturing the result).
  var REGEX_NEWLINE = /(\r?\n)/g;

  // Matches a Windows-style newline, or any character.
  var REGEX_CHARACTER = /\r\n|[\s\S]/g;

  /**
   * SourceNodes provide a way to abstract over interpolating/concatenating
   * snippets of generated JavaScript source code while maintaining the line and
   * column information associated with the original source code.
   *
   * @param aLine The original line number.
   * @param aColumn The original column number.
   * @param aSource The original source's filename.
   * @param aChunks Optional. An array of strings which are snippets of
   *        generated JS, or other SourceNodes.
   * @param aName The original identifier.
   */
  function SourceNode(aLine, aColumn, aSource, aChunks, aName) {
    this.children = [];
    this.sourceContents = {};
    this.line = aLine === undefined ? null : aLine;
    this.column = aColumn === undefined ? null : aColumn;
    this.source = aSource === undefined ? null : aSource;
    this.name = aName === undefined ? null : aName;
    if (aChunks != null) this.add(aChunks);
  }

  /**
   * Creates a SourceNode from generated code and a SourceMapConsumer.
   *
   * @param aGeneratedCode The generated code
   * @param aSourceMapConsumer The SourceMap for the generated code
   */
  SourceNode.fromStringWithSourceMap =
    function SourceNode_fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer) {
      // The SourceNode we want to fill with the generated code
      // and the SourceMap
      var node = new SourceNode();

      // All even indices of this array are one line of the generated code,
      // while all odd indices are the newlines between two adjacent lines
      // (since `REGEX_NEWLINE` captures its match).
      // Processed fragments are removed from this array, by calling `shiftNextLine`.
      var remainingLines = aGeneratedCode.split(REGEX_NEWLINE);
      var shiftNextLine = function() {
        var lineContents = remainingLines.shift();
        // The last line of a file might not have a newline.
        var newLine = remainingLines.shift() || "";
        return lineContents + newLine;
      };

      // We need to remember the position of "remainingLines"
      var lastGeneratedLine = 1, lastGeneratedColumn = 0;

      // The generate SourceNodes we need a code range.
      // To extract it current and last mapping is used.
      // Here we store the last mapping.
      var lastMapping = null;

      aSourceMapConsumer.eachMapping(function (mapping) {
        if (lastMapping !== null) {
          // We add the code from "lastMapping" to "mapping":
          // First check if there is a new line in between.
          if (lastGeneratedLine < mapping.generatedLine) {
            var code = "";
            // Associate first line with "lastMapping"
            addMappingWithCode(lastMapping, shiftNextLine());
            lastGeneratedLine++;
            lastGeneratedColumn = 0;
            // The remaining code is added without mapping
          } else {
            // There is no new line in between.
            // Associate the code between "lastGeneratedColumn" and
            // "mapping.generatedColumn" with "lastMapping"
            var nextLine = remainingLines[0];
            var code = nextLine.substr(0, mapping.generatedColumn -
                                          lastGeneratedColumn);
            remainingLines[0] = nextLine.substr(mapping.generatedColumn -
                                                lastGeneratedColumn);
            lastGeneratedColumn = mapping.generatedColumn;
            addMappingWithCode(lastMapping, code);
            // No more remaining code, continue
            lastMapping = mapping;
            return;
          }
        }
        // We add the generated code until the first mapping
        // to the SourceNode without any mapping.
        // Each line is added as separate string.
        while (lastGeneratedLine < mapping.generatedLine) {
          node.add(shiftNextLine());
          lastGeneratedLine++;
        }
        if (lastGeneratedColumn < mapping.generatedColumn) {
          var nextLine = remainingLines[0];
          node.add(nextLine.substr(0, mapping.generatedColumn));
          remainingLines[0] = nextLine.substr(mapping.generatedColumn);
          lastGeneratedColumn = mapping.generatedColumn;
        }
        lastMapping = mapping;
      }, this);
      // We have processed all mappings.
      if (remainingLines.length > 0) {
        if (lastMapping) {
          // Associate the remaining code in the current line with "lastMapping"
          addMappingWithCode(lastMapping, shiftNextLine());
        }
        // and add the remaining lines without any mapping
        node.add(remainingLines.join(""));
      }

      // Copy sourcesContent into SourceNode
      aSourceMapConsumer.sources.forEach(function (sourceFile) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content) {
          node.setSourceContent(sourceFile, content);
        }
      });

      return node;

      function addMappingWithCode(mapping, code) {
        if (mapping === null || mapping.source === undefined) {
          node.add(code);
        } else {
          node.add(new SourceNode(mapping.originalLine,
                                  mapping.originalColumn,
                                  mapping.source,
                                  code,
                                  mapping.name));
        }
      }
    };

  /**
   * Add a chunk of generated JS to this source node.
   *
   * @param aChunk A string snippet of generated JS code, another instance of
   *        SourceNode, or an array where each member is one of those things.
   */
  SourceNode.prototype.add = function SourceNode_add(aChunk) {
    if (Array.isArray(aChunk)) {
      aChunk.forEach(function (chunk) {
        this.add(chunk);
      }, this);
    }
    else if (aChunk instanceof SourceNode || typeof aChunk === "string") {
      if (aChunk) {
        this.children.push(aChunk);
      }
    }
    else {
      throw new TypeError(
        "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
      );
    }
    return this;
  };

  /**
   * Add a chunk of generated JS to the beginning of this source node.
   *
   * @param aChunk A string snippet of generated JS code, another instance of
   *        SourceNode, or an array where each member is one of those things.
   */
  SourceNode.prototype.prepend = function SourceNode_prepend(aChunk) {
    if (Array.isArray(aChunk)) {
      for (var i = aChunk.length-1; i >= 0; i--) {
        this.prepend(aChunk[i]);
      }
    }
    else if (aChunk instanceof SourceNode || typeof aChunk === "string") {
      this.children.unshift(aChunk);
    }
    else {
      throw new TypeError(
        "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
      );
    }
    return this;
  };

  /**
   * Walk over the tree of JS snippets in this node and its children. The
   * walking function is called once for each snippet of JS and is passed that
   * snippet and the its original associated source's line/column location.
   *
   * @param aFn The traversal function.
   */
  SourceNode.prototype.walk = function SourceNode_walk(aFn) {
    var chunk;
    for (var i = 0, len = this.children.length; i < len; i++) {
      chunk = this.children[i];
      if (chunk instanceof SourceNode) {
        chunk.walk(aFn);
      }
      else {
        if (chunk !== '') {
          aFn(chunk, { source: this.source,
                       line: this.line,
                       column: this.column,
                       name: this.name });
        }
      }
    }
  };

  /**
   * Like `String.prototype.join` except for SourceNodes. Inserts `aStr` between
   * each of `this.children`.
   *
   * @param aSep The separator.
   */
  SourceNode.prototype.join = function SourceNode_join(aSep) {
    var newChildren;
    var i;
    var len = this.children.length;
    if (len > 0) {
      newChildren = [];
      for (i = 0; i < len-1; i++) {
        newChildren.push(this.children[i]);
        newChildren.push(aSep);
      }
      newChildren.push(this.children[i]);
      this.children = newChildren;
    }
    return this;
  };

  /**
   * Call String.prototype.replace on the very right-most source snippet. Useful
   * for trimming whitespace from the end of a source node, etc.
   *
   * @param aPattern The pattern to replace.
   * @param aReplacement The thing to replace the pattern with.
   */
  SourceNode.prototype.replaceRight = function SourceNode_replaceRight(aPattern, aReplacement) {
    var lastChild = this.children[this.children.length - 1];
    if (lastChild instanceof SourceNode) {
      lastChild.replaceRight(aPattern, aReplacement);
    }
    else if (typeof lastChild === 'string') {
      this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement);
    }
    else {
      this.children.push(''.replace(aPattern, aReplacement));
    }
    return this;
  };

  /**
   * Set the source content for a source file. This will be added to the SourceMapGenerator
   * in the sourcesContent field.
   *
   * @param aSourceFile The filename of the source file
   * @param aSourceContent The content of the source file
   */
  SourceNode.prototype.setSourceContent =
    function SourceNode_setSourceContent(aSourceFile, aSourceContent) {
      this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent;
    };

  /**
   * Walk over the tree of SourceNodes. The walking function is called for each
   * source file content and is passed the filename and source content.
   *
   * @param aFn The traversal function.
   */
  SourceNode.prototype.walkSourceContents =
    function SourceNode_walkSourceContents(aFn) {
      for (var i = 0, len = this.children.length; i < len; i++) {
        if (this.children[i] instanceof SourceNode) {
          this.children[i].walkSourceContents(aFn);
        }
      }

      var sources = Object.keys(this.sourceContents);
      for (var i = 0, len = sources.length; i < len; i++) {
        aFn(util.fromSetString(sources[i]), this.sourceContents[sources[i]]);
      }
    };

  /**
   * Return the string representation of this source node. Walks over the tree
   * and concatenates all the various snippets together to one string.
   */
  SourceNode.prototype.toString = function SourceNode_toString() {
    var str = "";
    this.walk(function (chunk) {
      str += chunk;
    });
    return str;
  };

  /**
   * Returns the string representation of this source node along with a source
   * map.
   */
  SourceNode.prototype.toStringWithSourceMap = function SourceNode_toStringWithSourceMap(aArgs) {
    var generated = {
      code: "",
      line: 1,
      column: 0
    };
    var map = new SourceMapGenerator(aArgs);
    var sourceMappingActive = false;
    var lastOriginalSource = null;
    var lastOriginalLine = null;
    var lastOriginalColumn = null;
    var lastOriginalName = null;
    this.walk(function (chunk, original) {
      generated.code += chunk;
      if (original.source !== null
          && original.line !== null
          && original.column !== null) {
        if(lastOriginalSource !== original.source
           || lastOriginalLine !== original.line
           || lastOriginalColumn !== original.column
           || lastOriginalName !== original.name) {
          map.addMapping({
            source: original.source,
            original: {
              line: original.line,
              column: original.column
            },
            generated: {
              line: generated.line,
              column: generated.column
            },
            name: original.name
          });
        }
        lastOriginalSource = original.source;
        lastOriginalLine = original.line;
        lastOriginalColumn = original.column;
        lastOriginalName = original.name;
        sourceMappingActive = true;
      } else if (sourceMappingActive) {
        map.addMapping({
          generated: {
            line: generated.line,
            column: generated.column
          }
        });
        lastOriginalSource = null;
        sourceMappingActive = false;
      }
      chunk.match(REGEX_CHARACTER).forEach(function (ch, idx, array) {
        if (REGEX_NEWLINE.test(ch)) {
          generated.line++;
          generated.column = 0;
          // Mappings end at eol
          if (idx + 1 === array.length) {
            lastOriginalSource = null;
            sourceMappingActive = false;
          } else if (sourceMappingActive) {
            map.addMapping({
              source: original.source,
              original: {
                line: original.line,
                column: original.column
              },
              generated: {
                line: generated.line,
                column: generated.column
              },
              name: original.name
            });
          }
        } else {
          generated.column += ch.length;
        }
      });
    });
    this.walkSourceContents(function (sourceFile, sourceContent) {
      map.setSourceContent(sourceFile, sourceContent);
    });

    return { code: generated.code, map: map };
  };

  exports.SourceNode = SourceNode;

});

},{"./source-map-generator":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\source-map-generator.js","./util":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\util.js","amdefine":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\node_modules\\amdefine\\amdefine.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map\\util.js":[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  /**
   * This is a helper function for getting values from parameter/options
   * objects.
   *
   * @param args The object we are extracting values from
   * @param name The name of the property we are getting.
   * @param defaultValue An optional value to return if the property is missing
   * from the object. If this is not specified and the property is missing, an
   * error will be thrown.
   */
  function getArg(aArgs, aName, aDefaultValue) {
    if (aName in aArgs) {
      return aArgs[aName];
    } else if (arguments.length === 3) {
      return aDefaultValue;
    } else {
      throw new Error('"' + aName + '" is a required argument.');
    }
  }
  exports.getArg = getArg;

  var urlRegexp = /^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.]*)(?::(\d+))?(\S*)$/;
  var dataUrlRegexp = /^data:.+\,.+$/;

  function urlParse(aUrl) {
    var match = aUrl.match(urlRegexp);
    if (!match) {
      return null;
    }
    return {
      scheme: match[1],
      auth: match[2],
      host: match[3],
      port: match[4],
      path: match[5]
    };
  }
  exports.urlParse = urlParse;

  function urlGenerate(aParsedUrl) {
    var url = '';
    if (aParsedUrl.scheme) {
      url += aParsedUrl.scheme + ':';
    }
    url += '//';
    if (aParsedUrl.auth) {
      url += aParsedUrl.auth + '@';
    }
    if (aParsedUrl.host) {
      url += aParsedUrl.host;
    }
    if (aParsedUrl.port) {
      url += ":" + aParsedUrl.port
    }
    if (aParsedUrl.path) {
      url += aParsedUrl.path;
    }
    return url;
  }
  exports.urlGenerate = urlGenerate;

  /**
   * Normalizes a path, or the path portion of a URL:
   *
   * - Replaces consequtive slashes with one slash.
   * - Removes unnecessary '.' parts.
   * - Removes unnecessary '<dir>/..' parts.
   *
   * Based on code in the Node.js 'path' core module.
   *
   * @param aPath The path or url to normalize.
   */
  function normalize(aPath) {
    var path = aPath;
    var url = urlParse(aPath);
    if (url) {
      if (!url.path) {
        return aPath;
      }
      path = url.path;
    }
    var isAbsolute = (path.charAt(0) === '/');

    var parts = path.split(/\/+/);
    for (var part, up = 0, i = parts.length - 1; i >= 0; i--) {
      part = parts[i];
      if (part === '.') {
        parts.splice(i, 1);
      } else if (part === '..') {
        up++;
      } else if (up > 0) {
        if (part === '') {
          // The first part is blank if the path is absolute. Trying to go
          // above the root is a no-op. Therefore we can remove all '..' parts
          // directly after the root.
          parts.splice(i + 1, up);
          up = 0;
        } else {
          parts.splice(i, 2);
          up--;
        }
      }
    }
    path = parts.join('/');

    if (path === '') {
      path = isAbsolute ? '/' : '.';
    }

    if (url) {
      url.path = path;
      return urlGenerate(url);
    }
    return path;
  }
  exports.normalize = normalize;

  /**
   * Joins two paths/URLs.
   *
   * @param aRoot The root path or URL.
   * @param aPath The path or URL to be joined with the root.
   *
   * - If aPath is a URL or a data URI, aPath is returned, unless aPath is a
   *   scheme-relative URL: Then the scheme of aRoot, if any, is prepended
   *   first.
   * - Otherwise aPath is a path. If aRoot is a URL, then its path portion
   *   is updated with the result and aRoot is returned. Otherwise the result
   *   is returned.
   *   - If aPath is absolute, the result is aPath.
   *   - Otherwise the two paths are joined with a slash.
   * - Joining for example 'http://' and 'www.example.com' is also supported.
   */
  function join(aRoot, aPath) {
    var aPathUrl = urlParse(aPath);
    var aRootUrl = urlParse(aRoot);
    if (aRootUrl) {
      aRoot = aRootUrl.path || '/';
    }

    // `join(foo, '//www.example.org')`
    if (aPathUrl && !aPathUrl.scheme) {
      if (aRootUrl) {
        aPathUrl.scheme = aRootUrl.scheme;
      }
      return urlGenerate(aPathUrl);
    }

    if (aPathUrl || aPath.match(dataUrlRegexp)) {
      return aPath;
    }

    // `join('http://', 'www.example.com')`
    if (aRootUrl && !aRootUrl.host && !aRootUrl.path) {
      aRootUrl.host = aPath;
      return urlGenerate(aRootUrl);
    }

    var joined = aPath.charAt(0) === '/'
      ? aPath
      : normalize(aRoot.replace(/\/+$/, '') + '/' + aPath);

    if (aRootUrl) {
      aRootUrl.path = joined;
      return urlGenerate(aRootUrl);
    }
    return joined;
  }
  exports.join = join;

  /**
   * Because behavior goes wacky when you set `__proto__` on objects, we
   * have to prefix all the strings in our set with an arbitrary character.
   *
   * See https://github.com/mozilla/source-map/pull/31 and
   * https://github.com/mozilla/source-map/issues/30
   *
   * @param String aStr
   */
  function toSetString(aStr) {
    return '$' + aStr;
  }
  exports.toSetString = toSetString;

  function fromSetString(aStr) {
    return aStr.substr(1);
  }
  exports.fromSetString = fromSetString;

  function relative(aRoot, aPath) {
    aRoot = aRoot.replace(/\/$/, '');

    var url = urlParse(aRoot);
    if (aPath.charAt(0) == "/" && url && url.path == "/") {
      return aPath.slice(1);
    }

    return aPath.indexOf(aRoot + '/') === 0
      ? aPath.substr(aRoot.length + 1)
      : aPath;
  }
  exports.relative = relative;

  function strcmp(aStr1, aStr2) {
    var s1 = aStr1 || "";
    var s2 = aStr2 || "";
    return (s1 > s2) - (s1 < s2);
  }

  /**
   * Comparator between two mappings where the original positions are compared.
   *
   * Optionally pass in `true` as `onlyCompareGenerated` to consider two
   * mappings with the same original source/line/column, but different generated
   * line and column the same. Useful when searching for a mapping with a
   * stubbed out mapping.
   */
  function compareByOriginalPositions(mappingA, mappingB, onlyCompareOriginal) {
    var cmp;

    cmp = strcmp(mappingA.source, mappingB.source);
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp || onlyCompareOriginal) {
      return cmp;
    }

    cmp = strcmp(mappingA.name, mappingB.name);
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp) {
      return cmp;
    }

    return mappingA.generatedColumn - mappingB.generatedColumn;
  };
  exports.compareByOriginalPositions = compareByOriginalPositions;

  /**
   * Comparator between two mappings where the generated positions are
   * compared.
   *
   * Optionally pass in `true` as `onlyCompareGenerated` to consider two
   * mappings with the same generated line and column, but different
   * source/name/original line and column the same. Useful when searching for a
   * mapping with a stubbed out mapping.
   */
  function compareByGeneratedPositions(mappingA, mappingB, onlyCompareGenerated) {
    var cmp;

    cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.generatedColumn - mappingB.generatedColumn;
    if (cmp || onlyCompareGenerated) {
      return cmp;
    }

    cmp = strcmp(mappingA.source, mappingB.source);
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp) {
      return cmp;
    }

    return strcmp(mappingA.name, mappingB.name);
  };
  exports.compareByGeneratedPositions = compareByGeneratedPositions;

});

},{"amdefine":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\node_modules\\amdefine\\amdefine.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\node_modules\\amdefine\\amdefine.js":[function(require,module,exports){
(function (process,__filename){
/** vim: et:ts=4:sw=4:sts=4
 * @license amdefine 0.1.0 Copyright (c) 2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/amdefine for details
 */

/*jslint node: true */
/*global module, process */
'use strict';

/**
 * Creates a define for node.
 * @param {Object} module the "module" object that is defined by Node for the
 * current module.
 * @param {Function} [requireFn]. Node's require function for the current module.
 * It only needs to be passed in Node versions before 0.5, when module.require
 * did not exist.
 * @returns {Function} a define function that is usable for the current node
 * module.
 */
function amdefine(module, requireFn) {
    'use strict';
    var defineCache = {},
        loaderCache = {},
        alreadyCalled = false,
        path = require('path'),
        makeRequire, stringRequire;

    /**
     * Trims the . and .. from an array of path segments.
     * It will keep a leading path segment if a .. will become
     * the first path segment, to help with module name lookups,
     * which act like paths, but can be remapped. But the end result,
     * all paths that use this function should look normalized.
     * NOTE: this method MODIFIES the input array.
     * @param {Array} ary the array of path segments.
     */
    function trimDots(ary) {
        var i, part;
        for (i = 0; ary[i]; i+= 1) {
            part = ary[i];
            if (part === '.') {
                ary.splice(i, 1);
                i -= 1;
            } else if (part === '..') {
                if (i === 1 && (ary[2] === '..' || ary[0] === '..')) {
                    //End of the line. Keep at least one non-dot
                    //path segment at the front so it can be mapped
                    //correctly to disk. Otherwise, there is likely
                    //no path mapping for a path starting with '..'.
                    //This can still fail, but catches the most reasonable
                    //uses of ..
                    break;
                } else if (i > 0) {
                    ary.splice(i - 1, 2);
                    i -= 2;
                }
            }
        }
    }

    function normalize(name, baseName) {
        var baseParts;

        //Adjust any relative paths.
        if (name && name.charAt(0) === '.') {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                baseParts = baseName.split('/');
                baseParts = baseParts.slice(0, baseParts.length - 1);
                baseParts = baseParts.concat(name.split('/'));
                trimDots(baseParts);
                name = baseParts.join('/');
            }
        }

        return name;
    }

    /**
     * Create the normalize() function passed to a loader plugin's
     * normalize method.
     */
    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(id) {
        function load(value) {
            loaderCache[id] = value;
        }

        load.fromText = function (id, text) {
            //This one is difficult because the text can/probably uses
            //define, and any relative paths and requires should be relative
            //to that id was it would be found on disk. But this would require
            //bootstrapping a module/require fairly deeply from node core.
            //Not sure how best to go about that yet.
            throw new Error('amdefine does not implement load.fromText');
        };

        return load;
    }

    makeRequire = function (systemRequire, exports, module, relId) {
        function amdRequire(deps, callback) {
            if (typeof deps === 'string') {
                //Synchronous, single module require('')
                return stringRequire(systemRequire, exports, module, deps, relId);
            } else {
                //Array of dependencies with a callback.

                //Convert the dependencies to modules.
                deps = deps.map(function (depName) {
                    return stringRequire(systemRequire, exports, module, depName, relId);
                });

                //Wait for next tick to call back the require call.
                process.nextTick(function () {
                    callback.apply(null, deps);
                });
            }
        }

        amdRequire.toUrl = function (filePath) {
            if (filePath.indexOf('.') === 0) {
                return normalize(filePath, path.dirname(module.filename));
            } else {
                return filePath;
            }
        };

        return amdRequire;
    };

    //Favor explicit value, passed in if the module wants to support Node 0.4.
    requireFn = requireFn || function req() {
        return module.require.apply(module, arguments);
    };

    function runFactory(id, deps, factory) {
        var r, e, m, result;

        if (id) {
            e = loaderCache[id] = {};
            m = {
                id: id,
                uri: __filename,
                exports: e
            };
            r = makeRequire(requireFn, e, m, id);
        } else {
            //Only support one define call per file
            if (alreadyCalled) {
                throw new Error('amdefine with no module ID cannot be called more than once per file.');
            }
            alreadyCalled = true;

            //Use the real variables from node
            //Use module.exports for exports, since
            //the exports in here is amdefine exports.
            e = module.exports;
            m = module;
            r = makeRequire(requireFn, e, m, module.id);
        }

        //If there are dependencies, they are strings, so need
        //to convert them to dependency values.
        if (deps) {
            deps = deps.map(function (depName) {
                return r(depName);
            });
        }

        //Call the factory with the right dependencies.
        if (typeof factory === 'function') {
            result = factory.apply(m.exports, deps);
        } else {
            result = factory;
        }

        if (result !== undefined) {
            m.exports = result;
            if (id) {
                loaderCache[id] = m.exports;
            }
        }
    }

    stringRequire = function (systemRequire, exports, module, id, relId) {
        //Split the ID by a ! so that
        var index = id.indexOf('!'),
            originalId = id,
            prefix, plugin;

        if (index === -1) {
            id = normalize(id, relId);

            //Straight module lookup. If it is one of the special dependencies,
            //deal with it, otherwise, delegate to node.
            if (id === 'require') {
                return makeRequire(systemRequire, exports, module, relId);
            } else if (id === 'exports') {
                return exports;
            } else if (id === 'module') {
                return module;
            } else if (loaderCache.hasOwnProperty(id)) {
                return loaderCache[id];
            } else if (defineCache[id]) {
                runFactory.apply(null, defineCache[id]);
                return loaderCache[id];
            } else {
                if(systemRequire) {
                    return systemRequire(originalId);
                } else {
                    throw new Error('No module with ID: ' + id);
                }
            }
        } else {
            //There is a plugin in play.
            prefix = id.substring(0, index);
            id = id.substring(index + 1, id.length);

            plugin = stringRequire(systemRequire, exports, module, prefix, relId);

            if (plugin.normalize) {
                id = plugin.normalize(id, makeNormalize(relId));
            } else {
                //Normalize the ID normally.
                id = normalize(id, relId);
            }

            if (loaderCache[id]) {
                return loaderCache[id];
            } else {
                plugin.load(id, makeRequire(systemRequire, exports, module, relId), makeLoad(id), {});

                return loaderCache[id];
            }
        }
    };

    //Create a define function specific to the module asking for amdefine.
    function define(id, deps, factory) {
        if (Array.isArray(id)) {
            factory = deps;
            deps = id;
            id = undefined;
        } else if (typeof id !== 'string') {
            factory = id;
            id = deps = undefined;
        }

        if (deps && !Array.isArray(deps)) {
            factory = deps;
            deps = undefined;
        }

        if (!deps) {
            deps = ['require', 'exports', 'module'];
        }

        //Set up properties for this module. If an ID, then use
        //internal cache. If no ID, then use the external variables
        //for this node module.
        if (id) {
            //Put the module in deep freeze until there is a
            //require call for it.
            defineCache[id] = [id, deps, factory];
        } else {
            runFactory(id, deps, factory);
        }
    }

    //define.require, which has access to all the values in the
    //cache. Useful for AMD modules that all have IDs in the file,
    //but need to finally export a value to node based on one of those
    //IDs.
    define.require = function (id) {
        if (loaderCache[id]) {
            return loaderCache[id];
        }

        if (defineCache[id]) {
            runFactory.apply(null, defineCache[id]);
            return loaderCache[id];
        }
    };

    define.amd = {};

    return define;
}

module.exports = amdefine;

}).call(this,require('_process'),"/node_modules\\uglify-js\\node_modules\\source-map\\node_modules\\amdefine\\amdefine.js")
},{"_process":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\browserify\\node_modules\\process\\browser.js","path":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\browserify\\node_modules\\path-browserify\\index.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\tools\\node.js":[function(require,module,exports){
var sys = require("util");
var MOZ_SourceMap = require("source-map");
var UglifyJS = exports;
/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS2

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

function array_to_hash(a) {
    var ret = Object.create(null);
    for (var i = 0; i < a.length; ++i)
        ret[a[i]] = true;
    return ret;
};

function slice(a, start) {
    return Array.prototype.slice.call(a, start || 0);
};

function characters(str) {
    return str.split("");
};

function member(name, array) {
    for (var i = array.length; --i >= 0;)
        if (array[i] == name)
            return true;
    return false;
};

function find_if(func, array) {
    for (var i = 0, n = array.length; i < n; ++i) {
        if (func(array[i]))
            return array[i];
    }
};

function repeat_string(str, i) {
    if (i <= 0) return "";
    if (i == 1) return str;
    var d = repeat_string(str, i >> 1);
    d += d;
    if (i & 1) d += str;
    return d;
};

function DefaultsError(msg, defs) {
    Error.call(this, msg);
    this.msg = msg;
    this.defs = defs;
};
DefaultsError.prototype = Object.create(Error.prototype);
DefaultsError.prototype.constructor = DefaultsError;

DefaultsError.croak = function(msg, defs) {
    throw new DefaultsError(msg, defs);
};

function defaults(args, defs, croak) {
    if (args === true)
        args = {};
    var ret = args || {};
    if (croak) for (var i in ret) if (ret.hasOwnProperty(i) && !defs.hasOwnProperty(i))
        DefaultsError.croak("`" + i + "` is not a supported option", defs);
    for (var i in defs) if (defs.hasOwnProperty(i)) {
        ret[i] = (args && args.hasOwnProperty(i)) ? args[i] : defs[i];
    }
    return ret;
};

function merge(obj, ext) {
    for (var i in ext) if (ext.hasOwnProperty(i)) {
        obj[i] = ext[i];
    }
    return obj;
};

function noop() {};

var MAP = (function(){
    function MAP(a, f, backwards) {
        var ret = [], top = [], i;
        function doit() {
            var val = f(a[i], i);
            var is_last = val instanceof Last;
            if (is_last) val = val.v;
            if (val instanceof AtTop) {
                val = val.v;
                if (val instanceof Splice) {
                    top.push.apply(top, backwards ? val.v.slice().reverse() : val.v);
                } else {
                    top.push(val);
                }
            }
            else if (val !== skip) {
                if (val instanceof Splice) {
                    ret.push.apply(ret, backwards ? val.v.slice().reverse() : val.v);
                } else {
                    ret.push(val);
                }
            }
            return is_last;
        };
        if (a instanceof Array) {
            if (backwards) {
                for (i = a.length; --i >= 0;) if (doit()) break;
                ret.reverse();
                top.reverse();
            } else {
                for (i = 0; i < a.length; ++i) if (doit()) break;
            }
        }
        else {
            for (i in a) if (a.hasOwnProperty(i)) if (doit()) break;
        }
        return top.concat(ret);
    };
    MAP.at_top = function(val) { return new AtTop(val) };
    MAP.splice = function(val) { return new Splice(val) };
    MAP.last = function(val) { return new Last(val) };
    var skip = MAP.skip = {};
    function AtTop(val) { this.v = val };
    function Splice(val) { this.v = val };
    function Last(val) { this.v = val };
    return MAP;
})();

function push_uniq(array, el) {
    if (array.indexOf(el) < 0)
        array.push(el);
};

function string_template(text, props) {
    return text.replace(/\{(.+?)\}/g, function(str, p){
        return props[p];
    });
};

function remove(array, el) {
    for (var i = array.length; --i >= 0;) {
        if (array[i] === el) array.splice(i, 1);
    }
};

function mergeSort(array, cmp) {
    if (array.length < 2) return array.slice();
    function merge(a, b) {
        var r = [], ai = 0, bi = 0, i = 0;
        while (ai < a.length && bi < b.length) {
            cmp(a[ai], b[bi]) <= 0
                ? r[i++] = a[ai++]
                : r[i++] = b[bi++];
        }
        if (ai < a.length) r.push.apply(r, a.slice(ai));
        if (bi < b.length) r.push.apply(r, b.slice(bi));
        return r;
    };
    function _ms(a) {
        if (a.length <= 1)
            return a;
        var m = Math.floor(a.length / 2), left = a.slice(0, m), right = a.slice(m);
        left = _ms(left);
        right = _ms(right);
        return merge(left, right);
    };
    return _ms(array);
};

function set_difference(a, b) {
    return a.filter(function(el){
        return b.indexOf(el) < 0;
    });
};

function set_intersection(a, b) {
    return a.filter(function(el){
        return b.indexOf(el) >= 0;
    });
};

// this function is taken from Acorn [1], written by Marijn Haverbeke
// [1] https://github.com/marijnh/acorn
function makePredicate(words) {
    if (!(words instanceof Array)) words = words.split(" ");
    var f = "", cats = [];
    out: for (var i = 0; i < words.length; ++i) {
        for (var j = 0; j < cats.length; ++j)
            if (cats[j][0].length == words[i].length) {
                cats[j].push(words[i]);
                continue out;
            }
        cats.push([words[i]]);
    }
    function compareTo(arr) {
        if (arr.length == 1) return f += "return str === " + JSON.stringify(arr[0]) + ";";
        f += "switch(str){";
        for (var i = 0; i < arr.length; ++i) f += "case " + JSON.stringify(arr[i]) + ":";
        f += "return true}return false;";
    }
    // When there are more than three length categories, an outer
    // switch first dispatches on the lengths, to save on comparisons.
    if (cats.length > 3) {
        cats.sort(function(a, b) {return b.length - a.length;});
        f += "switch(str.length){";
        for (var i = 0; i < cats.length; ++i) {
            var cat = cats[i];
            f += "case " + cat[0].length + ":";
            compareTo(cat);
        }
        f += "}";
        // Otherwise, simply generate a flat `switch` statement.
    } else {
        compareTo(words);
    }
    return new Function("str", f);
};

function all(array, predicate) {
    for (var i = array.length; --i >= 0;)
        if (!predicate(array[i]))
            return false;
    return true;
};

function Dictionary() {
    this._values = Object.create(null);
    this._size = 0;
};
Dictionary.prototype = {
    set: function(key, val) {
        if (!this.has(key)) ++this._size;
        this._values["$" + key] = val;
        return this;
    },
    add: function(key, val) {
        if (this.has(key)) {
            this.get(key).push(val);
        } else {
            this.set(key, [ val ]);
        }
        return this;
    },
    get: function(key) { return this._values["$" + key] },
    del: function(key) {
        if (this.has(key)) {
            --this._size;
            delete this._values["$" + key];
        }
        return this;
    },
    has: function(key) { return ("$" + key) in this._values },
    each: function(f) {
        for (var i in this._values)
            f(this._values[i], i.substr(1));
    },
    size: function() {
        return this._size;
    },
    map: function(f) {
        var ret = [];
        for (var i in this._values)
            ret.push(f(this._values[i], i.substr(1)));
        return ret;
    }
};

/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS2

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

function DEFNODE(type, props, methods, base) {
    if (arguments.length < 4) base = AST_Node;
    if (!props) props = [];
    else props = props.split(/\s+/);
    var self_props = props;
    if (base && base.PROPS)
        props = props.concat(base.PROPS);
    var code = "return function AST_" + type + "(props){ if (props) { ";
    for (var i = props.length; --i >= 0;) {
        code += "this." + props[i] + " = props." + props[i] + ";";
    }
    var proto = base && new base;
    if (proto && proto.initialize || (methods && methods.initialize))
        code += "this.initialize();";
    code += "}}";
    var ctor = new Function(code)();
    if (proto) {
        ctor.prototype = proto;
        ctor.BASE = base;
    }
    if (base) base.SUBCLASSES.push(ctor);
    ctor.prototype.CTOR = ctor;
    ctor.PROPS = props || null;
    ctor.SELF_PROPS = self_props;
    ctor.SUBCLASSES = [];
    if (type) {
        ctor.prototype.TYPE = ctor.TYPE = type;
    }
    if (methods) for (i in methods) if (methods.hasOwnProperty(i)) {
        if (/^\$/.test(i)) {
            ctor[i.substr(1)] = methods[i];
        } else {
            ctor.prototype[i] = methods[i];
        }
    }
    ctor.DEFMETHOD = function(name, method) {
        this.prototype[name] = method;
    };
    return ctor;
};

var AST_Token = DEFNODE("Token", "type value line col pos endpos nlb comments_before file", {
}, null);

var AST_Node = DEFNODE("Node", "start end", {
    clone: function() {
        return new this.CTOR(this);
    },
    $documentation: "Base class of all AST nodes",
    $propdoc: {
        start: "[AST_Token] The first token of this node",
        end: "[AST_Token] The last token of this node"
    },
    _walk: function(visitor) {
        return visitor._visit(this);
    },
    walk: function(visitor) {
        return this._walk(visitor); // not sure the indirection will be any help
    }
}, null);

AST_Node.warn_function = null;
AST_Node.warn = function(txt, props) {
    if (AST_Node.warn_function)
        AST_Node.warn_function(string_template(txt, props));
};

/* -----[ statements ]----- */

var AST_Statement = DEFNODE("Statement", null, {
    $documentation: "Base class of all statements",
});

var AST_Debugger = DEFNODE("Debugger", null, {
    $documentation: "Represents a debugger statement",
}, AST_Statement);

var AST_Directive = DEFNODE("Directive", "value scope", {
    $documentation: "Represents a directive, like \"use strict\";",
    $propdoc: {
        value: "[string] The value of this directive as a plain string (it's not an AST_String!)",
        scope: "[AST_Scope/S] The scope that this directive affects"
    },
}, AST_Statement);

var AST_SimpleStatement = DEFNODE("SimpleStatement", "body", {
    $documentation: "A statement consisting of an expression, i.e. a = 1 + 2",
    $propdoc: {
        body: "[AST_Node] an expression node (should not be instanceof AST_Statement)"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.body._walk(visitor);
        });
    }
}, AST_Statement);

function walk_body(node, visitor) {
    if (node.body instanceof AST_Statement) {
        node.body._walk(visitor);
    }
    else node.body.forEach(function(stat){
        stat._walk(visitor);
    });
};

var AST_Block = DEFNODE("Block", "body", {
    $documentation: "A body of statements (usually bracketed)",
    $propdoc: {
        body: "[AST_Statement*] an array of statements"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            walk_body(this, visitor);
        });
    }
}, AST_Statement);

var AST_BlockStatement = DEFNODE("BlockStatement", null, {
    $documentation: "A block statement",
}, AST_Block);

var AST_EmptyStatement = DEFNODE("EmptyStatement", null, {
    $documentation: "The empty statement (empty block or simply a semicolon)",
    _walk: function(visitor) {
        return visitor._visit(this);
    }
}, AST_Statement);

var AST_StatementWithBody = DEFNODE("StatementWithBody", "body", {
    $documentation: "Base class for all statements that contain one nested body: `For`, `ForIn`, `Do`, `While`, `With`",
    $propdoc: {
        body: "[AST_Statement] the body; this should always be present, even if it's an AST_EmptyStatement"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.body._walk(visitor);
        });
    }
}, AST_Statement);

var AST_LabeledStatement = DEFNODE("LabeledStatement", "label", {
    $documentation: "Statement with a label",
    $propdoc: {
        label: "[AST_Label] a label definition"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.label._walk(visitor);
            this.body._walk(visitor);
        });
    }
}, AST_StatementWithBody);

var AST_IterationStatement = DEFNODE("IterationStatement", null, {
    $documentation: "Internal class.  All loops inherit from it."
}, AST_StatementWithBody);

var AST_DWLoop = DEFNODE("DWLoop", "condition", {
    $documentation: "Base class for do/while statements",
    $propdoc: {
        condition: "[AST_Node] the loop condition.  Should not be instanceof AST_Statement"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.condition._walk(visitor);
            this.body._walk(visitor);
        });
    }
}, AST_IterationStatement);

var AST_Do = DEFNODE("Do", null, {
    $documentation: "A `do` statement",
}, AST_DWLoop);

var AST_While = DEFNODE("While", null, {
    $documentation: "A `while` statement",
}, AST_DWLoop);

var AST_For = DEFNODE("For", "init condition step", {
    $documentation: "A `for` statement",
    $propdoc: {
        init: "[AST_Node?] the `for` initialization code, or null if empty",
        condition: "[AST_Node?] the `for` termination clause, or null if empty",
        step: "[AST_Node?] the `for` update clause, or null if empty"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            if (this.init) this.init._walk(visitor);
            if (this.condition) this.condition._walk(visitor);
            if (this.step) this.step._walk(visitor);
            this.body._walk(visitor);
        });
    }
}, AST_IterationStatement);

var AST_ForIn = DEFNODE("ForIn", "init name object", {
    $documentation: "A `for ... in` statement",
    $propdoc: {
        init: "[AST_Node] the `for/in` initialization code",
        name: "[AST_SymbolRef?] the loop variable, only if `init` is AST_Var",
        object: "[AST_Node] the object that we're looping through"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.init._walk(visitor);
            this.object._walk(visitor);
            this.body._walk(visitor);
        });
    }
}, AST_IterationStatement);

var AST_With = DEFNODE("With", "expression", {
    $documentation: "A `with` statement",
    $propdoc: {
        expression: "[AST_Node] the `with` expression"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.expression._walk(visitor);
            this.body._walk(visitor);
        });
    }
}, AST_StatementWithBody);

/* -----[ scope and functions ]----- */

var AST_Scope = DEFNODE("Scope", "directives variables functions uses_with uses_eval parent_scope enclosed cname", {
    $documentation: "Base class for all statements introducing a lexical scope",
    $propdoc: {
        directives: "[string*/S] an array of directives declared in this scope",
        variables: "[Object/S] a map of name -> SymbolDef for all variables/functions defined in this scope",
        functions: "[Object/S] like `variables`, but only lists function declarations",
        uses_with: "[boolean/S] tells whether this scope uses the `with` statement",
        uses_eval: "[boolean/S] tells whether this scope contains a direct call to the global `eval`",
        parent_scope: "[AST_Scope?/S] link to the parent scope",
        enclosed: "[SymbolDef*/S] a list of all symbol definitions that are accessed from this scope or any subscopes",
        cname: "[integer/S] current index for mangling variables (used internally by the mangler)",
    },
}, AST_Block);

var AST_Toplevel = DEFNODE("Toplevel", "globals", {
    $documentation: "The toplevel scope",
    $propdoc: {
        globals: "[Object/S] a map of name -> SymbolDef for all undeclared names",
    },
    wrap_enclose: function(arg_parameter_pairs) {
        var self = this;
        var args = [];
        var parameters = [];

        arg_parameter_pairs.forEach(function(pair) {
            var splitAt = pair.lastIndexOf(":");

            args.push(pair.substr(0, splitAt));
            parameters.push(pair.substr(splitAt + 1));
        });

        var wrapped_tl = "(function(" + parameters.join(",") + "){ '$ORIG'; })(" + args.join(",") + ")";
        wrapped_tl = parse(wrapped_tl);
        wrapped_tl = wrapped_tl.transform(new TreeTransformer(function before(node){
            if (node instanceof AST_Directive && node.value == "$ORIG") {
                return MAP.splice(self.body);
            }
        }));
        return wrapped_tl;
    },
    wrap_commonjs: function(name, export_all) {
        var self = this;
        var to_export = [];
        if (export_all) {
            self.figure_out_scope();
            self.walk(new TreeWalker(function(node){
                if (node instanceof AST_SymbolDeclaration && node.definition().global) {
                    if (!find_if(function(n){ return n.name == node.name }, to_export))
                        to_export.push(node);
                }
            }));
        }
        var wrapped_tl = "(function(exports, global){ global['" + name + "'] = exports; '$ORIG'; '$EXPORTS'; }({}, (function(){return this}())))";
        wrapped_tl = parse(wrapped_tl);
        wrapped_tl = wrapped_tl.transform(new TreeTransformer(function before(node){
            if (node instanceof AST_SimpleStatement) {
                node = node.body;
                if (node instanceof AST_String) switch (node.getValue()) {
                  case "$ORIG":
                    return MAP.splice(self.body);
                  case "$EXPORTS":
                    var body = [];
                    to_export.forEach(function(sym){
                        body.push(new AST_SimpleStatement({
                            body: new AST_Assign({
                                left: new AST_Sub({
                                    expression: new AST_SymbolRef({ name: "exports" }),
                                    property: new AST_String({ value: sym.name }),
                                }),
                                operator: "=",
                                right: new AST_SymbolRef(sym),
                            }),
                        }));
                    });
                    return MAP.splice(body);
                }
            }
        }));
        return wrapped_tl;
    }
}, AST_Scope);

var AST_Lambda = DEFNODE("Lambda", "name argnames uses_arguments", {
    $documentation: "Base class for functions",
    $propdoc: {
        name: "[AST_SymbolDeclaration?] the name of this function",
        argnames: "[AST_SymbolFunarg*] array of function arguments",
        uses_arguments: "[boolean/S] tells whether this function accesses the arguments array"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            if (this.name) this.name._walk(visitor);
            this.argnames.forEach(function(arg){
                arg._walk(visitor);
            });
            walk_body(this, visitor);
        });
    }
}, AST_Scope);

var AST_Accessor = DEFNODE("Accessor", null, {
    $documentation: "A setter/getter function.  The `name` property is always null."
}, AST_Lambda);

var AST_Function = DEFNODE("Function", null, {
    $documentation: "A function expression"
}, AST_Lambda);

var AST_Defun = DEFNODE("Defun", null, {
    $documentation: "A function definition"
}, AST_Lambda);

/* -----[ JUMPS ]----- */

var AST_Jump = DEFNODE("Jump", null, {
    $documentation: "Base class for “jumps” (for now that's `return`, `throw`, `break` and `continue`)"
}, AST_Statement);

var AST_Exit = DEFNODE("Exit", "value", {
    $documentation: "Base class for “exits” (`return` and `throw`)",
    $propdoc: {
        value: "[AST_Node?] the value returned or thrown by this statement; could be null for AST_Return"
    },
    _walk: function(visitor) {
        return visitor._visit(this, this.value && function(){
            this.value._walk(visitor);
        });
    }
}, AST_Jump);

var AST_Return = DEFNODE("Return", null, {
    $documentation: "A `return` statement"
}, AST_Exit);

var AST_Throw = DEFNODE("Throw", null, {
    $documentation: "A `throw` statement"
}, AST_Exit);

var AST_LoopControl = DEFNODE("LoopControl", "label", {
    $documentation: "Base class for loop control statements (`break` and `continue`)",
    $propdoc: {
        label: "[AST_LabelRef?] the label, or null if none",
    },
    _walk: function(visitor) {
        return visitor._visit(this, this.label && function(){
            this.label._walk(visitor);
        });
    }
}, AST_Jump);

var AST_Break = DEFNODE("Break", null, {
    $documentation: "A `break` statement"
}, AST_LoopControl);

var AST_Continue = DEFNODE("Continue", null, {
    $documentation: "A `continue` statement"
}, AST_LoopControl);

/* -----[ IF ]----- */

var AST_If = DEFNODE("If", "condition alternative", {
    $documentation: "A `if` statement",
    $propdoc: {
        condition: "[AST_Node] the `if` condition",
        alternative: "[AST_Statement?] the `else` part, or null if not present"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.condition._walk(visitor);
            this.body._walk(visitor);
            if (this.alternative) this.alternative._walk(visitor);
        });
    }
}, AST_StatementWithBody);

/* -----[ SWITCH ]----- */

var AST_Switch = DEFNODE("Switch", "expression", {
    $documentation: "A `switch` statement",
    $propdoc: {
        expression: "[AST_Node] the `switch` “discriminant”"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.expression._walk(visitor);
            walk_body(this, visitor);
        });
    }
}, AST_Block);

var AST_SwitchBranch = DEFNODE("SwitchBranch", null, {
    $documentation: "Base class for `switch` branches",
}, AST_Block);

var AST_Default = DEFNODE("Default", null, {
    $documentation: "A `default` switch branch",
}, AST_SwitchBranch);

var AST_Case = DEFNODE("Case", "expression", {
    $documentation: "A `case` switch branch",
    $propdoc: {
        expression: "[AST_Node] the `case` expression"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.expression._walk(visitor);
            walk_body(this, visitor);
        });
    }
}, AST_SwitchBranch);

/* -----[ EXCEPTIONS ]----- */

var AST_Try = DEFNODE("Try", "bcatch bfinally", {
    $documentation: "A `try` statement",
    $propdoc: {
        bcatch: "[AST_Catch?] the catch block, or null if not present",
        bfinally: "[AST_Finally?] the finally block, or null if not present"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            walk_body(this, visitor);
            if (this.bcatch) this.bcatch._walk(visitor);
            if (this.bfinally) this.bfinally._walk(visitor);
        });
    }
}, AST_Block);

var AST_Catch = DEFNODE("Catch", "argname", {
    $documentation: "A `catch` node; only makes sense as part of a `try` statement",
    $propdoc: {
        argname: "[AST_SymbolCatch] symbol for the exception"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.argname._walk(visitor);
            walk_body(this, visitor);
        });
    }
}, AST_Block);

var AST_Finally = DEFNODE("Finally", null, {
    $documentation: "A `finally` node; only makes sense as part of a `try` statement"
}, AST_Block);

/* -----[ VAR/CONST ]----- */

var AST_Definitions = DEFNODE("Definitions", "definitions", {
    $documentation: "Base class for `var` or `const` nodes (variable declarations/initializations)",
    $propdoc: {
        definitions: "[AST_VarDef*] array of variable definitions"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.definitions.forEach(function(def){
                def._walk(visitor);
            });
        });
    }
}, AST_Statement);

var AST_Var = DEFNODE("Var", null, {
    $documentation: "A `var` statement"
}, AST_Definitions);

var AST_Const = DEFNODE("Const", null, {
    $documentation: "A `const` statement"
}, AST_Definitions);

var AST_VarDef = DEFNODE("VarDef", "name value", {
    $documentation: "A variable declaration; only appears in a AST_Definitions node",
    $propdoc: {
        name: "[AST_SymbolVar|AST_SymbolConst] name of the variable",
        value: "[AST_Node?] initializer, or null of there's no initializer"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.name._walk(visitor);
            if (this.value) this.value._walk(visitor);
        });
    }
});

/* -----[ OTHER ]----- */

var AST_Call = DEFNODE("Call", "expression args", {
    $documentation: "A function call expression",
    $propdoc: {
        expression: "[AST_Node] expression to invoke as function",
        args: "[AST_Node*] array of arguments"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.expression._walk(visitor);
            this.args.forEach(function(arg){
                arg._walk(visitor);
            });
        });
    }
});

var AST_New = DEFNODE("New", null, {
    $documentation: "An object instantiation.  Derives from a function call since it has exactly the same properties"
}, AST_Call);

var AST_Seq = DEFNODE("Seq", "car cdr", {
    $documentation: "A sequence expression (two comma-separated expressions)",
    $propdoc: {
        car: "[AST_Node] first element in sequence",
        cdr: "[AST_Node] second element in sequence"
    },
    $cons: function(x, y) {
        var seq = new AST_Seq(x);
        seq.car = x;
        seq.cdr = y;
        return seq;
    },
    $from_array: function(array) {
        if (array.length == 0) return null;
        if (array.length == 1) return array[0].clone();
        var list = null;
        for (var i = array.length; --i >= 0;) {
            list = AST_Seq.cons(array[i], list);
        }
        var p = list;
        while (p) {
            if (p.cdr && !p.cdr.cdr) {
                p.cdr = p.cdr.car;
                break;
            }
            p = p.cdr;
        }
        return list;
    },
    to_array: function() {
        var p = this, a = [];
        while (p) {
            a.push(p.car);
            if (p.cdr && !(p.cdr instanceof AST_Seq)) {
                a.push(p.cdr);
                break;
            }
            p = p.cdr;
        }
        return a;
    },
    add: function(node) {
        var p = this;
        while (p) {
            if (!(p.cdr instanceof AST_Seq)) {
                var cell = AST_Seq.cons(p.cdr, node);
                return p.cdr = cell;
            }
            p = p.cdr;
        }
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.car._walk(visitor);
            if (this.cdr) this.cdr._walk(visitor);
        });
    }
});

var AST_PropAccess = DEFNODE("PropAccess", "expression property", {
    $documentation: "Base class for property access expressions, i.e. `a.foo` or `a[\"foo\"]`",
    $propdoc: {
        expression: "[AST_Node] the “container” expression",
        property: "[AST_Node|string] the property to access.  For AST_Dot this is always a plain string, while for AST_Sub it's an arbitrary AST_Node"
    }
});

var AST_Dot = DEFNODE("Dot", null, {
    $documentation: "A dotted property access expression",
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.expression._walk(visitor);
        });
    }
}, AST_PropAccess);

var AST_Sub = DEFNODE("Sub", null, {
    $documentation: "Index-style property access, i.e. `a[\"foo\"]`",
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.expression._walk(visitor);
            this.property._walk(visitor);
        });
    }
}, AST_PropAccess);

var AST_Unary = DEFNODE("Unary", "operator expression", {
    $documentation: "Base class for unary expressions",
    $propdoc: {
        operator: "[string] the operator",
        expression: "[AST_Node] expression that this unary operator applies to"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.expression._walk(visitor);
        });
    }
});

var AST_UnaryPrefix = DEFNODE("UnaryPrefix", null, {
    $documentation: "Unary prefix expression, i.e. `typeof i` or `++i`"
}, AST_Unary);

var AST_UnaryPostfix = DEFNODE("UnaryPostfix", null, {
    $documentation: "Unary postfix expression, i.e. `i++`"
}, AST_Unary);

var AST_Binary = DEFNODE("Binary", "left operator right", {
    $documentation: "Binary expression, i.e. `a + b`",
    $propdoc: {
        left: "[AST_Node] left-hand side expression",
        operator: "[string] the operator",
        right: "[AST_Node] right-hand side expression"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.left._walk(visitor);
            this.right._walk(visitor);
        });
    }
});

var AST_Conditional = DEFNODE("Conditional", "condition consequent alternative", {
    $documentation: "Conditional expression using the ternary operator, i.e. `a ? b : c`",
    $propdoc: {
        condition: "[AST_Node]",
        consequent: "[AST_Node]",
        alternative: "[AST_Node]"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.condition._walk(visitor);
            this.consequent._walk(visitor);
            this.alternative._walk(visitor);
        });
    }
});

var AST_Assign = DEFNODE("Assign", null, {
    $documentation: "An assignment expression — `a = b + 5`",
}, AST_Binary);

/* -----[ LITERALS ]----- */

var AST_Array = DEFNODE("Array", "elements", {
    $documentation: "An array literal",
    $propdoc: {
        elements: "[AST_Node*] array of elements"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.elements.forEach(function(el){
                el._walk(visitor);
            });
        });
    }
});

var AST_Object = DEFNODE("Object", "properties", {
    $documentation: "An object literal",
    $propdoc: {
        properties: "[AST_ObjectProperty*] array of properties"
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.properties.forEach(function(prop){
                prop._walk(visitor);
            });
        });
    }
});

var AST_ObjectProperty = DEFNODE("ObjectProperty", "key value", {
    $documentation: "Base class for literal object properties",
    $propdoc: {
        key: "[string] the property name converted to a string for ObjectKeyVal.  For setters and getters this is an arbitrary AST_Node.",
        value: "[AST_Node] property value.  For setters and getters this is an AST_Function."
    },
    _walk: function(visitor) {
        return visitor._visit(this, function(){
            this.value._walk(visitor);
        });
    }
});

var AST_ObjectKeyVal = DEFNODE("ObjectKeyVal", null, {
    $documentation: "A key: value object property",
}, AST_ObjectProperty);

var AST_ObjectSetter = DEFNODE("ObjectSetter", null, {
    $documentation: "An object setter property",
}, AST_ObjectProperty);

var AST_ObjectGetter = DEFNODE("ObjectGetter", null, {
    $documentation: "An object getter property",
}, AST_ObjectProperty);

var AST_Symbol = DEFNODE("Symbol", "scope name thedef", {
    $propdoc: {
        name: "[string] name of this symbol",
        scope: "[AST_Scope/S] the current scope (not necessarily the definition scope)",
        thedef: "[SymbolDef/S] the definition of this symbol"
    },
    $documentation: "Base class for all symbols",
});

var AST_SymbolAccessor = DEFNODE("SymbolAccessor", null, {
    $documentation: "The name of a property accessor (setter/getter function)"
}, AST_Symbol);

var AST_SymbolDeclaration = DEFNODE("SymbolDeclaration", "init", {
    $documentation: "A declaration symbol (symbol in var/const, function name or argument, symbol in catch)",
    $propdoc: {
        init: "[AST_Node*/S] array of initializers for this declaration."
    }
}, AST_Symbol);

var AST_SymbolVar = DEFNODE("SymbolVar", null, {
    $documentation: "Symbol defining a variable",
}, AST_SymbolDeclaration);

var AST_SymbolConst = DEFNODE("SymbolConst", null, {
    $documentation: "A constant declaration"
}, AST_SymbolDeclaration);

var AST_SymbolFunarg = DEFNODE("SymbolFunarg", null, {
    $documentation: "Symbol naming a function argument",
}, AST_SymbolVar);

var AST_SymbolDefun = DEFNODE("SymbolDefun", null, {
    $documentation: "Symbol defining a function",
}, AST_SymbolDeclaration);

var AST_SymbolLambda = DEFNODE("SymbolLambda", null, {
    $documentation: "Symbol naming a function expression",
}, AST_SymbolDeclaration);

var AST_SymbolCatch = DEFNODE("SymbolCatch", null, {
    $documentation: "Symbol naming the exception in catch",
}, AST_SymbolDeclaration);

var AST_Label = DEFNODE("Label", "references", {
    $documentation: "Symbol naming a label (declaration)",
    $propdoc: {
        references: "[AST_LoopControl*] a list of nodes referring to this label"
    },
    initialize: function() {
        this.references = [];
        this.thedef = this;
    }
}, AST_Symbol);

var AST_SymbolRef = DEFNODE("SymbolRef", null, {
    $documentation: "Reference to some symbol (not definition/declaration)",
}, AST_Symbol);

var AST_LabelRef = DEFNODE("LabelRef", null, {
    $documentation: "Reference to a label symbol",
}, AST_Symbol);

var AST_This = DEFNODE("This", null, {
    $documentation: "The `this` symbol",
}, AST_Symbol);

var AST_Constant = DEFNODE("Constant", null, {
    $documentation: "Base class for all constants",
    getValue: function() {
        return this.value;
    }
});

var AST_String = DEFNODE("String", "value", {
    $documentation: "A string literal",
    $propdoc: {
        value: "[string] the contents of this string"
    }
}, AST_Constant);

var AST_Number = DEFNODE("Number", "value", {
    $documentation: "A number literal",
    $propdoc: {
        value: "[number] the numeric value"
    }
}, AST_Constant);

var AST_RegExp = DEFNODE("RegExp", "value", {
    $documentation: "A regexp literal",
    $propdoc: {
        value: "[RegExp] the actual regexp"
    }
}, AST_Constant);

var AST_Atom = DEFNODE("Atom", null, {
    $documentation: "Base class for atoms",
}, AST_Constant);

var AST_Null = DEFNODE("Null", null, {
    $documentation: "The `null` atom",
    value: null
}, AST_Atom);

var AST_NaN = DEFNODE("NaN", null, {
    $documentation: "The impossible value",
    value: 0/0
}, AST_Atom);

var AST_Undefined = DEFNODE("Undefined", null, {
    $documentation: "The `undefined` value",
    value: (function(){}())
}, AST_Atom);

var AST_Hole = DEFNODE("Hole", null, {
    $documentation: "A hole in an array",
    value: (function(){}())
}, AST_Atom);

var AST_Infinity = DEFNODE("Infinity", null, {
    $documentation: "The `Infinity` value",
    value: 1/0
}, AST_Atom);

var AST_Boolean = DEFNODE("Boolean", null, {
    $documentation: "Base class for booleans",
}, AST_Atom);

var AST_False = DEFNODE("False", null, {
    $documentation: "The `false` atom",
    value: false
}, AST_Boolean);

var AST_True = DEFNODE("True", null, {
    $documentation: "The `true` atom",
    value: true
}, AST_Boolean);

/* -----[ TreeWalker ]----- */

function TreeWalker(callback) {
    this.visit = callback;
    this.stack = [];
};
TreeWalker.prototype = {
    _visit: function(node, descend) {
        this.stack.push(node);
        var ret = this.visit(node, descend ? function(){
            descend.call(node);
        } : noop);
        if (!ret && descend) {
            descend.call(node);
        }
        this.stack.pop();
        return ret;
    },
    parent: function(n) {
        return this.stack[this.stack.length - 2 - (n || 0)];
    },
    push: function (node) {
        this.stack.push(node);
    },
    pop: function() {
        return this.stack.pop();
    },
    self: function() {
        return this.stack[this.stack.length - 1];
    },
    find_parent: function(type) {
        var stack = this.stack;
        for (var i = stack.length; --i >= 0;) {
            var x = stack[i];
            if (x instanceof type) return x;
        }
    },
    has_directive: function(type) {
        return this.find_parent(AST_Scope).has_directive(type);
    },
    in_boolean_context: function() {
        var stack = this.stack;
        var i = stack.length, self = stack[--i];
        while (i > 0) {
            var p = stack[--i];
            if ((p instanceof AST_If           && p.condition === self) ||
                (p instanceof AST_Conditional  && p.condition === self) ||
                (p instanceof AST_DWLoop       && p.condition === self) ||
                (p instanceof AST_For          && p.condition === self) ||
                (p instanceof AST_UnaryPrefix  && p.operator == "!" && p.expression === self))
            {
                return true;
            }
            if (!(p instanceof AST_Binary && (p.operator == "&&" || p.operator == "||")))
                return false;
            self = p;
        }
    },
    loopcontrol_target: function(label) {
        var stack = this.stack;
        if (label) for (var i = stack.length; --i >= 0;) {
            var x = stack[i];
            if (x instanceof AST_LabeledStatement && x.label.name == label.name) {
                return x.body;
            }
        } else for (var i = stack.length; --i >= 0;) {
            var x = stack[i];
            if (x instanceof AST_Switch || x instanceof AST_IterationStatement)
                return x;
        }
    }
};

/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS2

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>
    Parser based on parse-js (http://marijn.haverbeke.nl/parse-js/).

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

var KEYWORDS = 'break case catch const continue debugger default delete do else finally for function if in instanceof new return switch throw try typeof var void while with';
var KEYWORDS_ATOM = 'false null true';
var RESERVED_WORDS = 'abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized this throws transient volatile yield'
    + " " + KEYWORDS_ATOM + " " + KEYWORDS;
var KEYWORDS_BEFORE_EXPRESSION = 'return new delete throw else case';

KEYWORDS = makePredicate(KEYWORDS);
RESERVED_WORDS = makePredicate(RESERVED_WORDS);
KEYWORDS_BEFORE_EXPRESSION = makePredicate(KEYWORDS_BEFORE_EXPRESSION);
KEYWORDS_ATOM = makePredicate(KEYWORDS_ATOM);

var OPERATOR_CHARS = makePredicate(characters("+-*&%=<>!?|~^"));

var RE_HEX_NUMBER = /^0x[0-9a-f]+$/i;
var RE_OCT_NUMBER = /^0[0-7]+$/;
var RE_DEC_NUMBER = /^\d*\.?\d*(?:e[+-]?\d*(?:\d\.?|\.?\d)\d*)?$/i;

var OPERATORS = makePredicate([
    "in",
    "instanceof",
    "typeof",
    "new",
    "void",
    "delete",
    "++",
    "--",
    "+",
    "-",
    "!",
    "~",
    "&",
    "|",
    "^",
    "*",
    "/",
    "%",
    ">>",
    "<<",
    ">>>",
    "<",
    ">",
    "<=",
    ">=",
    "==",
    "===",
    "!=",
    "!==",
    "?",
    "=",
    "+=",
    "-=",
    "/=",
    "*=",
    "%=",
    ">>=",
    "<<=",
    ">>>=",
    "|=",
    "^=",
    "&=",
    "&&",
    "||"
]);

var WHITESPACE_CHARS = makePredicate(characters(" \u00a0\n\r\t\f\u000b\u200b\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000"));

var PUNC_BEFORE_EXPRESSION = makePredicate(characters("[{(,.;:"));

var PUNC_CHARS = makePredicate(characters("[]{}(),;:"));

var REGEXP_MODIFIERS = makePredicate(characters("gmsiy"));

/* -----[ Tokenizer ]----- */

// regexps adapted from http://xregexp.com/plugins/#unicode
var UNICODE = {
    letter: new RegExp("[\\u0041-\\u005A\\u0061-\\u007A\\u00AA\\u00B5\\u00BA\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02C1\\u02C6-\\u02D1\\u02E0-\\u02E4\\u02EC\\u02EE\\u0370-\\u0374\\u0376\\u0377\\u037A-\\u037D\\u0386\\u0388-\\u038A\\u038C\\u038E-\\u03A1\\u03A3-\\u03F5\\u03F7-\\u0481\\u048A-\\u0523\\u0531-\\u0556\\u0559\\u0561-\\u0587\\u05D0-\\u05EA\\u05F0-\\u05F2\\u0621-\\u064A\\u066E\\u066F\\u0671-\\u06D3\\u06D5\\u06E5\\u06E6\\u06EE\\u06EF\\u06FA-\\u06FC\\u06FF\\u0710\\u0712-\\u072F\\u074D-\\u07A5\\u07B1\\u07CA-\\u07EA\\u07F4\\u07F5\\u07FA\\u0904-\\u0939\\u093D\\u0950\\u0958-\\u0961\\u0971\\u0972\\u097B-\\u097F\\u0985-\\u098C\\u098F\\u0990\\u0993-\\u09A8\\u09AA-\\u09B0\\u09B2\\u09B6-\\u09B9\\u09BD\\u09CE\\u09DC\\u09DD\\u09DF-\\u09E1\\u09F0\\u09F1\\u0A05-\\u0A0A\\u0A0F\\u0A10\\u0A13-\\u0A28\\u0A2A-\\u0A30\\u0A32\\u0A33\\u0A35\\u0A36\\u0A38\\u0A39\\u0A59-\\u0A5C\\u0A5E\\u0A72-\\u0A74\\u0A85-\\u0A8D\\u0A8F-\\u0A91\\u0A93-\\u0AA8\\u0AAA-\\u0AB0\\u0AB2\\u0AB3\\u0AB5-\\u0AB9\\u0ABD\\u0AD0\\u0AE0\\u0AE1\\u0B05-\\u0B0C\\u0B0F\\u0B10\\u0B13-\\u0B28\\u0B2A-\\u0B30\\u0B32\\u0B33\\u0B35-\\u0B39\\u0B3D\\u0B5C\\u0B5D\\u0B5F-\\u0B61\\u0B71\\u0B83\\u0B85-\\u0B8A\\u0B8E-\\u0B90\\u0B92-\\u0B95\\u0B99\\u0B9A\\u0B9C\\u0B9E\\u0B9F\\u0BA3\\u0BA4\\u0BA8-\\u0BAA\\u0BAE-\\u0BB9\\u0BD0\\u0C05-\\u0C0C\\u0C0E-\\u0C10\\u0C12-\\u0C28\\u0C2A-\\u0C33\\u0C35-\\u0C39\\u0C3D\\u0C58\\u0C59\\u0C60\\u0C61\\u0C85-\\u0C8C\\u0C8E-\\u0C90\\u0C92-\\u0CA8\\u0CAA-\\u0CB3\\u0CB5-\\u0CB9\\u0CBD\\u0CDE\\u0CE0\\u0CE1\\u0D05-\\u0D0C\\u0D0E-\\u0D10\\u0D12-\\u0D28\\u0D2A-\\u0D39\\u0D3D\\u0D60\\u0D61\\u0D7A-\\u0D7F\\u0D85-\\u0D96\\u0D9A-\\u0DB1\\u0DB3-\\u0DBB\\u0DBD\\u0DC0-\\u0DC6\\u0E01-\\u0E30\\u0E32\\u0E33\\u0E40-\\u0E46\\u0E81\\u0E82\\u0E84\\u0E87\\u0E88\\u0E8A\\u0E8D\\u0E94-\\u0E97\\u0E99-\\u0E9F\\u0EA1-\\u0EA3\\u0EA5\\u0EA7\\u0EAA\\u0EAB\\u0EAD-\\u0EB0\\u0EB2\\u0EB3\\u0EBD\\u0EC0-\\u0EC4\\u0EC6\\u0EDC\\u0EDD\\u0F00\\u0F40-\\u0F47\\u0F49-\\u0F6C\\u0F88-\\u0F8B\\u1000-\\u102A\\u103F\\u1050-\\u1055\\u105A-\\u105D\\u1061\\u1065\\u1066\\u106E-\\u1070\\u1075-\\u1081\\u108E\\u10A0-\\u10C5\\u10D0-\\u10FA\\u10FC\\u1100-\\u1159\\u115F-\\u11A2\\u11A8-\\u11F9\\u1200-\\u1248\\u124A-\\u124D\\u1250-\\u1256\\u1258\\u125A-\\u125D\\u1260-\\u1288\\u128A-\\u128D\\u1290-\\u12B0\\u12B2-\\u12B5\\u12B8-\\u12BE\\u12C0\\u12C2-\\u12C5\\u12C8-\\u12D6\\u12D8-\\u1310\\u1312-\\u1315\\u1318-\\u135A\\u1380-\\u138F\\u13A0-\\u13F4\\u1401-\\u166C\\u166F-\\u1676\\u1681-\\u169A\\u16A0-\\u16EA\\u1700-\\u170C\\u170E-\\u1711\\u1720-\\u1731\\u1740-\\u1751\\u1760-\\u176C\\u176E-\\u1770\\u1780-\\u17B3\\u17D7\\u17DC\\u1820-\\u1877\\u1880-\\u18A8\\u18AA\\u1900-\\u191C\\u1950-\\u196D\\u1970-\\u1974\\u1980-\\u19A9\\u19C1-\\u19C7\\u1A00-\\u1A16\\u1B05-\\u1B33\\u1B45-\\u1B4B\\u1B83-\\u1BA0\\u1BAE\\u1BAF\\u1C00-\\u1C23\\u1C4D-\\u1C4F\\u1C5A-\\u1C7D\\u1D00-\\u1DBF\\u1E00-\\u1F15\\u1F18-\\u1F1D\\u1F20-\\u1F45\\u1F48-\\u1F4D\\u1F50-\\u1F57\\u1F59\\u1F5B\\u1F5D\\u1F5F-\\u1F7D\\u1F80-\\u1FB4\\u1FB6-\\u1FBC\\u1FBE\\u1FC2-\\u1FC4\\u1FC6-\\u1FCC\\u1FD0-\\u1FD3\\u1FD6-\\u1FDB\\u1FE0-\\u1FEC\\u1FF2-\\u1FF4\\u1FF6-\\u1FFC\\u2071\\u207F\\u2090-\\u2094\\u2102\\u2107\\u210A-\\u2113\\u2115\\u2119-\\u211D\\u2124\\u2126\\u2128\\u212A-\\u212D\\u212F-\\u2139\\u213C-\\u213F\\u2145-\\u2149\\u214E\\u2183\\u2184\\u2C00-\\u2C2E\\u2C30-\\u2C5E\\u2C60-\\u2C6F\\u2C71-\\u2C7D\\u2C80-\\u2CE4\\u2D00-\\u2D25\\u2D30-\\u2D65\\u2D6F\\u2D80-\\u2D96\\u2DA0-\\u2DA6\\u2DA8-\\u2DAE\\u2DB0-\\u2DB6\\u2DB8-\\u2DBE\\u2DC0-\\u2DC6\\u2DC8-\\u2DCE\\u2DD0-\\u2DD6\\u2DD8-\\u2DDE\\u2E2F\\u3005\\u3006\\u3031-\\u3035\\u303B\\u303C\\u3041-\\u3096\\u309D-\\u309F\\u30A1-\\u30FA\\u30FC-\\u30FF\\u3105-\\u312D\\u3131-\\u318E\\u31A0-\\u31B7\\u31F0-\\u31FF\\u3400\\u4DB5\\u4E00\\u9FC3\\uA000-\\uA48C\\uA500-\\uA60C\\uA610-\\uA61F\\uA62A\\uA62B\\uA640-\\uA65F\\uA662-\\uA66E\\uA67F-\\uA697\\uA717-\\uA71F\\uA722-\\uA788\\uA78B\\uA78C\\uA7FB-\\uA801\\uA803-\\uA805\\uA807-\\uA80A\\uA80C-\\uA822\\uA840-\\uA873\\uA882-\\uA8B3\\uA90A-\\uA925\\uA930-\\uA946\\uAA00-\\uAA28\\uAA40-\\uAA42\\uAA44-\\uAA4B\\uAC00\\uD7A3\\uF900-\\uFA2D\\uFA30-\\uFA6A\\uFA70-\\uFAD9\\uFB00-\\uFB06\\uFB13-\\uFB17\\uFB1D\\uFB1F-\\uFB28\\uFB2A-\\uFB36\\uFB38-\\uFB3C\\uFB3E\\uFB40\\uFB41\\uFB43\\uFB44\\uFB46-\\uFBB1\\uFBD3-\\uFD3D\\uFD50-\\uFD8F\\uFD92-\\uFDC7\\uFDF0-\\uFDFB\\uFE70-\\uFE74\\uFE76-\\uFEFC\\uFF21-\\uFF3A\\uFF41-\\uFF5A\\uFF66-\\uFFBE\\uFFC2-\\uFFC7\\uFFCA-\\uFFCF\\uFFD2-\\uFFD7\\uFFDA-\\uFFDC]"),
    non_spacing_mark: new RegExp("[\\u0300-\\u036F\\u0483-\\u0487\\u0591-\\u05BD\\u05BF\\u05C1\\u05C2\\u05C4\\u05C5\\u05C7\\u0610-\\u061A\\u064B-\\u065E\\u0670\\u06D6-\\u06DC\\u06DF-\\u06E4\\u06E7\\u06E8\\u06EA-\\u06ED\\u0711\\u0730-\\u074A\\u07A6-\\u07B0\\u07EB-\\u07F3\\u0816-\\u0819\\u081B-\\u0823\\u0825-\\u0827\\u0829-\\u082D\\u0900-\\u0902\\u093C\\u0941-\\u0948\\u094D\\u0951-\\u0955\\u0962\\u0963\\u0981\\u09BC\\u09C1-\\u09C4\\u09CD\\u09E2\\u09E3\\u0A01\\u0A02\\u0A3C\\u0A41\\u0A42\\u0A47\\u0A48\\u0A4B-\\u0A4D\\u0A51\\u0A70\\u0A71\\u0A75\\u0A81\\u0A82\\u0ABC\\u0AC1-\\u0AC5\\u0AC7\\u0AC8\\u0ACD\\u0AE2\\u0AE3\\u0B01\\u0B3C\\u0B3F\\u0B41-\\u0B44\\u0B4D\\u0B56\\u0B62\\u0B63\\u0B82\\u0BC0\\u0BCD\\u0C3E-\\u0C40\\u0C46-\\u0C48\\u0C4A-\\u0C4D\\u0C55\\u0C56\\u0C62\\u0C63\\u0CBC\\u0CBF\\u0CC6\\u0CCC\\u0CCD\\u0CE2\\u0CE3\\u0D41-\\u0D44\\u0D4D\\u0D62\\u0D63\\u0DCA\\u0DD2-\\u0DD4\\u0DD6\\u0E31\\u0E34-\\u0E3A\\u0E47-\\u0E4E\\u0EB1\\u0EB4-\\u0EB9\\u0EBB\\u0EBC\\u0EC8-\\u0ECD\\u0F18\\u0F19\\u0F35\\u0F37\\u0F39\\u0F71-\\u0F7E\\u0F80-\\u0F84\\u0F86\\u0F87\\u0F90-\\u0F97\\u0F99-\\u0FBC\\u0FC6\\u102D-\\u1030\\u1032-\\u1037\\u1039\\u103A\\u103D\\u103E\\u1058\\u1059\\u105E-\\u1060\\u1071-\\u1074\\u1082\\u1085\\u1086\\u108D\\u109D\\u135F\\u1712-\\u1714\\u1732-\\u1734\\u1752\\u1753\\u1772\\u1773\\u17B7-\\u17BD\\u17C6\\u17C9-\\u17D3\\u17DD\\u180B-\\u180D\\u18A9\\u1920-\\u1922\\u1927\\u1928\\u1932\\u1939-\\u193B\\u1A17\\u1A18\\u1A56\\u1A58-\\u1A5E\\u1A60\\u1A62\\u1A65-\\u1A6C\\u1A73-\\u1A7C\\u1A7F\\u1B00-\\u1B03\\u1B34\\u1B36-\\u1B3A\\u1B3C\\u1B42\\u1B6B-\\u1B73\\u1B80\\u1B81\\u1BA2-\\u1BA5\\u1BA8\\u1BA9\\u1C2C-\\u1C33\\u1C36\\u1C37\\u1CD0-\\u1CD2\\u1CD4-\\u1CE0\\u1CE2-\\u1CE8\\u1CED\\u1DC0-\\u1DE6\\u1DFD-\\u1DFF\\u20D0-\\u20DC\\u20E1\\u20E5-\\u20F0\\u2CEF-\\u2CF1\\u2DE0-\\u2DFF\\u302A-\\u302F\\u3099\\u309A\\uA66F\\uA67C\\uA67D\\uA6F0\\uA6F1\\uA802\\uA806\\uA80B\\uA825\\uA826\\uA8C4\\uA8E0-\\uA8F1\\uA926-\\uA92D\\uA947-\\uA951\\uA980-\\uA982\\uA9B3\\uA9B6-\\uA9B9\\uA9BC\\uAA29-\\uAA2E\\uAA31\\uAA32\\uAA35\\uAA36\\uAA43\\uAA4C\\uAAB0\\uAAB2-\\uAAB4\\uAAB7\\uAAB8\\uAABE\\uAABF\\uAAC1\\uABE5\\uABE8\\uABED\\uFB1E\\uFE00-\\uFE0F\\uFE20-\\uFE26]"),
    space_combining_mark: new RegExp("[\\u0903\\u093E-\\u0940\\u0949-\\u094C\\u094E\\u0982\\u0983\\u09BE-\\u09C0\\u09C7\\u09C8\\u09CB\\u09CC\\u09D7\\u0A03\\u0A3E-\\u0A40\\u0A83\\u0ABE-\\u0AC0\\u0AC9\\u0ACB\\u0ACC\\u0B02\\u0B03\\u0B3E\\u0B40\\u0B47\\u0B48\\u0B4B\\u0B4C\\u0B57\\u0BBE\\u0BBF\\u0BC1\\u0BC2\\u0BC6-\\u0BC8\\u0BCA-\\u0BCC\\u0BD7\\u0C01-\\u0C03\\u0C41-\\u0C44\\u0C82\\u0C83\\u0CBE\\u0CC0-\\u0CC4\\u0CC7\\u0CC8\\u0CCA\\u0CCB\\u0CD5\\u0CD6\\u0D02\\u0D03\\u0D3E-\\u0D40\\u0D46-\\u0D48\\u0D4A-\\u0D4C\\u0D57\\u0D82\\u0D83\\u0DCF-\\u0DD1\\u0DD8-\\u0DDF\\u0DF2\\u0DF3\\u0F3E\\u0F3F\\u0F7F\\u102B\\u102C\\u1031\\u1038\\u103B\\u103C\\u1056\\u1057\\u1062-\\u1064\\u1067-\\u106D\\u1083\\u1084\\u1087-\\u108C\\u108F\\u109A-\\u109C\\u17B6\\u17BE-\\u17C5\\u17C7\\u17C8\\u1923-\\u1926\\u1929-\\u192B\\u1930\\u1931\\u1933-\\u1938\\u19B0-\\u19C0\\u19C8\\u19C9\\u1A19-\\u1A1B\\u1A55\\u1A57\\u1A61\\u1A63\\u1A64\\u1A6D-\\u1A72\\u1B04\\u1B35\\u1B3B\\u1B3D-\\u1B41\\u1B43\\u1B44\\u1B82\\u1BA1\\u1BA6\\u1BA7\\u1BAA\\u1C24-\\u1C2B\\u1C34\\u1C35\\u1CE1\\u1CF2\\uA823\\uA824\\uA827\\uA880\\uA881\\uA8B4-\\uA8C3\\uA952\\uA953\\uA983\\uA9B4\\uA9B5\\uA9BA\\uA9BB\\uA9BD-\\uA9C0\\uAA2F\\uAA30\\uAA33\\uAA34\\uAA4D\\uAA7B\\uABE3\\uABE4\\uABE6\\uABE7\\uABE9\\uABEA\\uABEC]"),
    connector_punctuation: new RegExp("[\\u005F\\u203F\\u2040\\u2054\\uFE33\\uFE34\\uFE4D-\\uFE4F\\uFF3F]")
};

function is_letter(code) {
    return (code >= 97 && code <= 122)
        || (code >= 65 && code <= 90)
        || (code >= 0xaa && UNICODE.letter.test(String.fromCharCode(code)));
};

function is_digit(code) {
    return code >= 48 && code <= 57; //XXX: find out if "UnicodeDigit" means something else than 0..9
};

function is_alphanumeric_char(code) {
    return is_digit(code) || is_letter(code);
};

function is_unicode_combining_mark(ch) {
    return UNICODE.non_spacing_mark.test(ch) || UNICODE.space_combining_mark.test(ch);
};

function is_unicode_connector_punctuation(ch) {
    return UNICODE.connector_punctuation.test(ch);
};

function is_identifier(name) {
    return !RESERVED_WORDS(name) && /^[a-z_$][a-z0-9_$]*$/i.test(name);
};

function is_identifier_start(code) {
    return code == 36 || code == 95 || is_letter(code);
};

function is_identifier_char(ch) {
    var code = ch.charCodeAt(0);
    return is_identifier_start(code)
        || is_digit(code)
        || code == 8204 // \u200c: zero-width non-joiner <ZWNJ>
        || code == 8205 // \u200d: zero-width joiner <ZWJ> (in my ECMA-262 PDF, this is also 200c)
        || is_unicode_combining_mark(ch)
        || is_unicode_connector_punctuation(ch)
    ;
};

function is_identifier_string(str){
    return /^[a-z_$][a-z0-9_$]*$/i.test(str);
};

function parse_js_number(num) {
    if (RE_HEX_NUMBER.test(num)) {
        return parseInt(num.substr(2), 16);
    } else if (RE_OCT_NUMBER.test(num)) {
        return parseInt(num.substr(1), 8);
    } else if (RE_DEC_NUMBER.test(num)) {
        return parseFloat(num);
    }
};

function JS_Parse_Error(message, line, col, pos) {
    this.message = message;
    this.line = line;
    this.col = col;
    this.pos = pos;
    this.stack = new Error().stack;
};

JS_Parse_Error.prototype.toString = function() {
    return this.message + " (line: " + this.line + ", col: " + this.col + ", pos: " + this.pos + ")" + "\n\n" + this.stack;
};

function js_error(message, filename, line, col, pos) {
    throw new JS_Parse_Error(message, line, col, pos);
};

function is_token(token, type, val) {
    return token.type == type && (val == null || token.value == val);
};

var EX_EOF = {};

function tokenizer($TEXT, filename, html5_comments) {

    var S = {
        text            : $TEXT.replace(/\r\n?|[\n\u2028\u2029]/g, "\n").replace(/\uFEFF/g, ''),
        filename        : filename,
        pos             : 0,
        tokpos          : 0,
        line            : 1,
        tokline         : 0,
        col             : 0,
        tokcol          : 0,
        newline_before  : false,
        regex_allowed   : false,
        comments_before : []
    };

    function peek() { return S.text.charAt(S.pos); };

    function next(signal_eof, in_string) {
        var ch = S.text.charAt(S.pos++);
        if (signal_eof && !ch)
            throw EX_EOF;
        if (ch == "\n") {
            S.newline_before = S.newline_before || !in_string;
            ++S.line;
            S.col = 0;
        } else {
            ++S.col;
        }
        return ch;
    };

    function forward(i) {
        while (i-- > 0) next();
    };

    function looking_at(str) {
        return S.text.substr(S.pos, str.length) == str;
    };

    function find(what, signal_eof) {
        var pos = S.text.indexOf(what, S.pos);
        if (signal_eof && pos == -1) throw EX_EOF;
        return pos;
    };

    function start_token() {
        S.tokline = S.line;
        S.tokcol = S.col;
        S.tokpos = S.pos;
    };

    var prev_was_dot = false;
    function token(type, value, is_comment) {
        S.regex_allowed = ((type == "operator" && !UNARY_POSTFIX(value)) ||
                           (type == "keyword" && KEYWORDS_BEFORE_EXPRESSION(value)) ||
                           (type == "punc" && PUNC_BEFORE_EXPRESSION(value)));
        prev_was_dot = (type == "punc" && value == ".");
        var ret = {
            type   : type,
            value  : value,
            line   : S.tokline,
            col    : S.tokcol,
            pos    : S.tokpos,
            endpos : S.pos,
            nlb    : S.newline_before,
            file   : filename
        };
        if (!is_comment) {
            ret.comments_before = S.comments_before;
            S.comments_before = [];
            // make note of any newlines in the comments that came before
            for (var i = 0, len = ret.comments_before.length; i < len; i++) {
                ret.nlb = ret.nlb || ret.comments_before[i].nlb;
            }
        }
        S.newline_before = false;
        return new AST_Token(ret);
    };

    function skip_whitespace() {
        while (WHITESPACE_CHARS(peek()))
            next();
    };

    function read_while(pred) {
        var ret = "", ch, i = 0;
        while ((ch = peek()) && pred(ch, i++))
            ret += next();
        return ret;
    };

    function parse_error(err) {
        js_error(err, filename, S.tokline, S.tokcol, S.tokpos);
    };

    function read_num(prefix) {
        var has_e = false, after_e = false, has_x = false, has_dot = prefix == ".";
        var num = read_while(function(ch, i){
            var code = ch.charCodeAt(0);
            switch (code) {
              case 120: case 88: // xX
                return has_x ? false : (has_x = true);
              case 101: case 69: // eE
                return has_x ? true : has_e ? false : (has_e = after_e = true);
              case 45: // -
                return after_e || (i == 0 && !prefix);
              case 43: // +
                return after_e;
              case (after_e = false, 46): // .
                return (!has_dot && !has_x && !has_e) ? (has_dot = true) : false;
            }
            return is_alphanumeric_char(code);
        });
        if (prefix) num = prefix + num;
        var valid = parse_js_number(num);
        if (!isNaN(valid)) {
            return token("num", valid);
        } else {
            parse_error("Invalid syntax: " + num);
        }
    };

    function read_escaped_char(in_string) {
        var ch = next(true, in_string);
        switch (ch.charCodeAt(0)) {
          case 110 : return "\n";
          case 114 : return "\r";
          case 116 : return "\t";
          case 98  : return "\b";
          case 118 : return "\u000b"; // \v
          case 102 : return "\f";
          case 48  : return "\0";
          case 120 : return String.fromCharCode(hex_bytes(2)); // \x
          case 117 : return String.fromCharCode(hex_bytes(4)); // \u
          case 10  : return ""; // newline
          default  : return ch;
        }
    };

    function hex_bytes(n) {
        var num = 0;
        for (; n > 0; --n) {
            var digit = parseInt(next(true), 16);
            if (isNaN(digit))
                parse_error("Invalid hex-character pattern in string");
            num = (num << 4) | digit;
        }
        return num;
    };

    var read_string = with_eof_error("Unterminated string constant", function(){
        var quote = next(), ret = "";
        for (;;) {
            var ch = next(true);
            if (ch == "\\") {
                // read OctalEscapeSequence (XXX: deprecated if "strict mode")
                // https://github.com/mishoo/UglifyJS/issues/178
                var octal_len = 0, first = null;
                ch = read_while(function(ch){
                    if (ch >= "0" && ch <= "7") {
                        if (!first) {
                            first = ch;
                            return ++octal_len;
                        }
                        else if (first <= "3" && octal_len <= 2) return ++octal_len;
                        else if (first >= "4" && octal_len <= 1) return ++octal_len;
                    }
                    return false;
                });
                if (octal_len > 0) ch = String.fromCharCode(parseInt(ch, 8));
                else ch = read_escaped_char(true);
            }
            else if (ch == quote) break;
            ret += ch;
        }
        return token("string", ret);
    });

    function skip_line_comment(type) {
        var regex_allowed = S.regex_allowed;
        var i = find("\n"), ret;
        if (i == -1) {
            ret = S.text.substr(S.pos);
            S.pos = S.text.length;
        } else {
            ret = S.text.substring(S.pos, i);
            S.pos = i;
        }
        S.comments_before.push(token(type, ret, true));
        S.regex_allowed = regex_allowed;
        return next_token();
    };

    var skip_multiline_comment = with_eof_error("Unterminated multiline comment", function(){
        var regex_allowed = S.regex_allowed;
        var i = find("*/", true);
        var text = S.text.substring(S.pos, i);
        var a = text.split("\n"), n = a.length;
        // update stream position
        S.pos = i + 2;
        S.line += n - 1;
        if (n > 1) S.col = a[n - 1].length;
        else S.col += a[n - 1].length;
        S.col += 2;
        var nlb = S.newline_before = S.newline_before || text.indexOf("\n") >= 0;
        S.comments_before.push(token("comment2", text, true));
        S.regex_allowed = regex_allowed;
        S.newline_before = nlb;
        return next_token();
    });

    function read_name() {
        var backslash = false, name = "", ch, escaped = false, hex;
        while ((ch = peek()) != null) {
            if (!backslash) {
                if (ch == "\\") escaped = backslash = true, next();
                else if (is_identifier_char(ch)) name += next();
                else break;
            }
            else {
                if (ch != "u") parse_error("Expecting UnicodeEscapeSequence -- uXXXX");
                ch = read_escaped_char();
                if (!is_identifier_char(ch)) parse_error("Unicode char: " + ch.charCodeAt(0) + " is not valid in identifier");
                name += ch;
                backslash = false;
            }
        }
        if (KEYWORDS(name) && escaped) {
            hex = name.charCodeAt(0).toString(16).toUpperCase();
            name = "\\u" + "0000".substr(hex.length) + hex + name.slice(1);
        }
        return name;
    };

    var read_regexp = with_eof_error("Unterminated regular expression", function(regexp){
        var prev_backslash = false, ch, in_class = false;
        while ((ch = next(true))) if (prev_backslash) {
            regexp += "\\" + ch;
            prev_backslash = false;
        } else if (ch == "[") {
            in_class = true;
            regexp += ch;
        } else if (ch == "]" && in_class) {
            in_class = false;
            regexp += ch;
        } else if (ch == "/" && !in_class) {
            break;
        } else if (ch == "\\") {
            prev_backslash = true;
        } else {
            regexp += ch;
        }
        var mods = read_name();
        return token("regexp", new RegExp(regexp, mods));
    });

    function read_operator(prefix) {
        function grow(op) {
            if (!peek()) return op;
            var bigger = op + peek();
            if (OPERATORS(bigger)) {
                next();
                return grow(bigger);
            } else {
                return op;
            }
        };
        return token("operator", grow(prefix || next()));
    };

    function handle_slash() {
        next();
        switch (peek()) {
          case "/":
            next();
            return skip_line_comment("comment1");
          case "*":
            next();
            return skip_multiline_comment();
        }
        return S.regex_allowed ? read_regexp("") : read_operator("/");
    };

    function handle_dot() {
        next();
        return is_digit(peek().charCodeAt(0))
            ? read_num(".")
            : token("punc", ".");
    };

    function read_word() {
        var word = read_name();
        if (prev_was_dot) return token("name", word);
        return KEYWORDS_ATOM(word) ? token("atom", word)
            : !KEYWORDS(word) ? token("name", word)
            : OPERATORS(word) ? token("operator", word)
            : token("keyword", word);
    };

    function with_eof_error(eof_error, cont) {
        return function(x) {
            try {
                return cont(x);
            } catch(ex) {
                if (ex === EX_EOF) parse_error(eof_error);
                else throw ex;
            }
        };
    };

    function next_token(force_regexp) {
        if (force_regexp != null)
            return read_regexp(force_regexp);
        skip_whitespace();
        start_token();
        if (html5_comments) {
            if (looking_at("<!--")) {
                forward(4);
                return skip_line_comment("comment3");
            }
            if (looking_at("-->") && S.newline_before) {
                forward(3);
                return skip_line_comment("comment4");
            }
        }
        var ch = peek();
        if (!ch) return token("eof");
        var code = ch.charCodeAt(0);
        switch (code) {
          case 34: case 39: return read_string();
          case 46: return handle_dot();
          case 47: return handle_slash();
        }
        if (is_digit(code)) return read_num();
        if (PUNC_CHARS(ch)) return token("punc", next());
        if (OPERATOR_CHARS(ch)) return read_operator();
        if (code == 92 || is_identifier_start(code)) return read_word();
        parse_error("Unexpected character '" + ch + "'");
    };

    next_token.context = function(nc) {
        if (nc) S = nc;
        return S;
    };

    return next_token;

};

/* -----[ Parser (constants) ]----- */

var UNARY_PREFIX = makePredicate([
    "typeof",
    "void",
    "delete",
    "--",
    "++",
    "!",
    "~",
    "-",
    "+"
]);

var UNARY_POSTFIX = makePredicate([ "--", "++" ]);

var ASSIGNMENT = makePredicate([ "=", "+=", "-=", "/=", "*=", "%=", ">>=", "<<=", ">>>=", "|=", "^=", "&=" ]);

var PRECEDENCE = (function(a, ret){
    for (var i = 0; i < a.length; ++i) {
        var b = a[i];
        for (var j = 0; j < b.length; ++j) {
            ret[b[j]] = i + 1;
        }
    }
    return ret;
})(
    [
        ["||"],
        ["&&"],
        ["|"],
        ["^"],
        ["&"],
        ["==", "===", "!=", "!=="],
        ["<", ">", "<=", ">=", "in", "instanceof"],
        [">>", "<<", ">>>"],
        ["+", "-"],
        ["*", "/", "%"]
    ],
    {}
);

var STATEMENTS_WITH_LABELS = array_to_hash([ "fo" + "r", "do", "while", "switch" ]);

var ATOMIC_START_TOKEN = array_to_hash([ "atom", "num", "string", "regexp", "name" ]);

/* -----[ Parser ]----- */

function parse($TEXT, options) {

    options = defaults(options, {
        strict         : false,
        filename       : null,
        toplevel       : null,
        expression     : false,
        html5_comments : true,
    });

    var S = {
        input         : (typeof $TEXT == "string"
                         ? tokenizer($TEXT, options.filename,
                                     options.html5_comments)
                         : $TEXT),
        token         : null,
        prev          : null,
        peeked        : null,
        in_function   : 0,
        in_directives : true,
        in_loop       : 0,
        labels        : []
    };

    S.token = next();

    function is(type, value) {
        return is_token(S.token, type, value);
    };

    function peek() { return S.peeked || (S.peeked = S.input()); };

    function next() {
        S.prev = S.token;
        if (S.peeked) {
            S.token = S.peeked;
            S.peeked = null;
        } else {
            S.token = S.input();
        }
        S.in_directives = S.in_directives && (
            S.token.type == "string" || is("punc", ";")
        );
        return S.token;
    };

    function prev() {
        return S.prev;
    };

    function croak(msg, line, col, pos) {
        var ctx = S.input.context();
        js_error(msg,
                 ctx.filename,
                 line != null ? line : ctx.tokline,
                 col != null ? col : ctx.tokcol,
                 pos != null ? pos : ctx.tokpos);
    };

    function token_error(token, msg) {
        croak(msg, token.line, token.col);
    };

    function unexpected(token) {
        if (token == null)
            token = S.token;
        token_error(token, "Unexpected token: " + token.type + " (" + token.value + ")");
    };

    function expect_token(type, val) {
        if (is(type, val)) {
            return next();
        }
        token_error(S.token, "Unexpected token " + S.token.type + " «" + S.token.value + "»" + ", expected " + type + " «" + val + "»");
    };

    function expect(punc) { return expect_token("punc", punc); };

    function can_insert_semicolon() {
        return !options.strict && (
            S.token.nlb || is("eof") || is("punc", "}")
        );
    };

    function semicolon() {
        if (is("punc", ";")) next();
        else if (!can_insert_semicolon()) unexpected();
    };

    function parenthesised() {
        expect("(");
        var exp = expression(true);
        expect(")");
        return exp;
    };

    function embed_tokens(parser) {
        return function() {
            var start = S.token;
            var expr = parser();
            var end = prev();
            expr.start = start;
            expr.end = end;
            return expr;
        };
    };

    function handle_regexp() {
        if (is("operator", "/") || is("operator", "/=")) {
            S.peeked = null;
            S.token = S.input(S.token.value.substr(1)); // force regexp
        }
    };

    var statement = embed_tokens(function() {
        var tmp;
        handle_regexp();
        switch (S.token.type) {
          case "string":
            var dir = S.in_directives, stat = simple_statement();
            // XXXv2: decide how to fix directives
            if (dir && stat.body instanceof AST_String && !is("punc", ","))
                return new AST_Directive({ value: stat.body.value });
            return stat;
          case "num":
          case "regexp":
          case "operator":
          case "atom":
            return simple_statement();

          case "name":
            return is_token(peek(), "punc", ":")
                ? labeled_statement()
                : simple_statement();

          case "punc":
            switch (S.token.value) {
              case "{":
                return new AST_BlockStatement({
                    start : S.token,
                    body  : block_(),
                    end   : prev()
                });
              case "[":
              case "(":
                return simple_statement();
              case ";":
                next();
                return new AST_EmptyStatement();
              default:
                unexpected();
            }

          case "keyword":
            switch (tmp = S.token.value, next(), tmp) {
              case "break":
                return break_cont(AST_Break);

              case "continue":
                return break_cont(AST_Continue);

              case "debugger":
                semicolon();
                return new AST_Debugger();

              case "do":
                return new AST_Do({
                    body      : in_loop(statement),
                    condition : (expect_token("keyword", "while"), tmp = parenthesised(), semicolon(), tmp)
                });

              case "while":
                return new AST_While({
                    condition : parenthesised(),
                    body      : in_loop(statement)
                });

              case "fo" + "r":
                return for_();

              case "function":
                return function_(AST_Defun);

              case "if":
                return if_();

              case "return":
                if (S.in_function == 0)
                    croak("'return' outside of function");
                return new AST_Return({
                    value: ( is("punc", ";")
                             ? (next(), null)
                             : can_insert_semicolon()
                             ? null
                             : (tmp = expression(true), semicolon(), tmp) )
                });

              case "switch":
                return new AST_Switch({
                    expression : parenthesised(),
                    body       : in_loop(switch_body_)
                });

              case "throw":
                if (S.token.nlb)
                    croak("Illegal newline after 'throw'");
                return new AST_Throw({
                    value: (tmp = expression(true), semicolon(), tmp)
                });

              case "try":
                return try_();

              case "var":
                return tmp = var_(), semicolon(), tmp;

              case "const":
                return tmp = const_(), semicolon(), tmp;

              case "with":
                return new AST_With({
                    expression : parenthesised(),
                    body       : statement()
                });

              default:
                unexpected();
            }
        }
    });

    function labeled_statement() {
        var label = as_symbol(AST_Label);
        if (find_if(function(l){ return l.name == label.name }, S.labels)) {
            // ECMA-262, 12.12: An ECMAScript program is considered
            // syntactically incorrect if it contains a
            // LabelledStatement that is enclosed by a
            // LabelledStatement with the same Identifier as label.
            croak("Label " + label.name + " defined twice");
        }
        expect(":");
        S.labels.push(label);
        var stat = statement();
        S.labels.pop();
        if (!(stat instanceof AST_IterationStatement)) {
            // check for `continue` that refers to this label.
            // those should be reported as syntax errors.
            // https://github.com/mishoo/UglifyJS2/issues/287
            label.references.forEach(function(ref){
                if (ref instanceof AST_Continue) {
                    ref = ref.label.start;
                    croak("Continue label `" + label.name + "` refers to non-IterationStatement.",
                          ref.line, ref.col, ref.pos);
                }
            });
        }
        return new AST_LabeledStatement({ body: stat, label: label });
    };

    function simple_statement(tmp) {
        return new AST_SimpleStatement({ body: (tmp = expression(true), semicolon(), tmp) });
    };

    function break_cont(type) {
        var label = null, ldef;
        if (!can_insert_semicolon()) {
            label = as_symbol(AST_LabelRef, true);
        }
        if (label != null) {
            ldef = find_if(function(l){ return l.name == label.name }, S.labels);
            if (!ldef)
                croak("Undefined label " + label.name);
            label.thedef = ldef;
        }
        else if (S.in_loop == 0)
            croak(type.TYPE + " not inside a loop or switch");
        semicolon();
        var stat = new type({ label: label });
        if (ldef) ldef.references.push(stat);
        return stat;
    };

    function for_() {
        expect("(");
        var init = null;
        if (!is("punc", ";")) {
            init = is("keyword", "var")
                ? (next(), var_(true))
                : expression(true, true);
            if (is("operator", "in")) {
                if (init instanceof AST_Var && init.definitions.length > 1)
                    croak("Only one variable declaration allowed in for..in loop");
                next();
                return for_in(init);
            }
        }
        return regular_for(init);
    };

    function regular_for(init) {
        expect(";");
        var test = is("punc", ";") ? null : expression(true);
        expect(";");
        var step = is("punc", ")") ? null : expression(true);
        expect(")");
        return new AST_For({
            init      : init,
            condition : test,
            step      : step,
            body      : in_loop(statement)
        });
    };

    function for_in(init) {
        var lhs = init instanceof AST_Var ? init.definitions[0].name : null;
        var obj = expression(true);
        expect(")");
        return new AST_ForIn({
            init   : init,
            name   : lhs,
            object : obj,
            body   : in_loop(statement)
        });
    };

    var function_ = function(ctor) {
        var in_statement = ctor === AST_Defun;
        var name = is("name") ? as_symbol(in_statement ? AST_SymbolDefun : AST_SymbolLambda) : null;
        if (in_statement && !name)
            unexpected();
        expect("(");
        return new ctor({
            name: name,
            argnames: (function(first, a){
                while (!is("punc", ")")) {
                    if (first) first = false; else expect(",");
                    a.push(as_symbol(AST_SymbolFunarg));
                }
                next();
                return a;
            })(true, []),
            body: (function(loop, labels){
                ++S.in_function;
                S.in_directives = true;
                S.in_loop = 0;
                S.labels = [];
                var a = block_();
                --S.in_function;
                S.in_loop = loop;
                S.labels = labels;
                return a;
            })(S.in_loop, S.labels)
        });
    };

    function if_() {
        var cond = parenthesised(), body = statement(), belse = null;
        if (is("keyword", "else")) {
            next();
            belse = statement();
        }
        return new AST_If({
            condition   : cond,
            body        : body,
            alternative : belse
        });
    };

    function block_() {
        expect("{");
        var a = [];
        while (!is("punc", "}")) {
            if (is("eof")) unexpected();
            a.push(statement());
        }
        next();
        return a;
    };

    function switch_body_() {
        expect("{");
        var a = [], cur = null, branch = null, tmp;
        while (!is("punc", "}")) {
            if (is("eof")) unexpected();
            if (is("keyword", "case")) {
                if (branch) branch.end = prev();
                cur = [];
                branch = new AST_Case({
                    start      : (tmp = S.token, next(), tmp),
                    expression : expression(true),
                    body       : cur
                });
                a.push(branch);
                expect(":");
            }
            else if (is("keyword", "default")) {
                if (branch) branch.end = prev();
                cur = [];
                branch = new AST_Default({
                    start : (tmp = S.token, next(), expect(":"), tmp),
                    body  : cur
                });
                a.push(branch);
            }
            else {
                if (!cur) unexpected();
                cur.push(statement());
            }
        }
        if (branch) branch.end = prev();
        next();
        return a;
    };

    function try_() {
        var body = block_(), bcatch = null, bfinally = null;
        if (is("keyword", "catch")) {
            var start = S.token;
            next();
            expect("(");
            var name = as_symbol(AST_SymbolCatch);
            expect(")");
            bcatch = new AST_Catch({
                start   : start,
                argname : name,
                body    : block_(),
                end     : prev()
            });
        }
        if (is("keyword", "finally")) {
            var start = S.token;
            next();
            bfinally = new AST_Finally({
                start : start,
                body  : block_(),
                end   : prev()
            });
        }
        if (!bcatch && !bfinally)
            croak("Missing catch/finally blocks");
        return new AST_Try({
            body     : body,
            bcatch   : bcatch,
            bfinally : bfinally
        });
    };

    function vardefs(no_in, in_const) {
        var a = [];
        for (;;) {
            a.push(new AST_VarDef({
                start : S.token,
                name  : as_symbol(in_const ? AST_SymbolConst : AST_SymbolVar),
                value : is("operator", "=") ? (next(), expression(false, no_in)) : null,
                end   : prev()
            }));
            if (!is("punc", ","))
                break;
            next();
        }
        return a;
    };

    var var_ = function(no_in) {
        return new AST_Var({
            start       : prev(),
            definitions : vardefs(no_in, false),
            end         : prev()
        });
    };

    var const_ = function() {
        return new AST_Const({
            start       : prev(),
            definitions : vardefs(false, true),
            end         : prev()
        });
    };

    var new_ = function() {
        var start = S.token;
        expect_token("operator", "new");
        var newexp = expr_atom(false), args;
        if (is("punc", "(")) {
            next();
            args = expr_list(")");
        } else {
            args = [];
        }
        return subscripts(new AST_New({
            start      : start,
            expression : newexp,
            args       : args,
            end        : prev()
        }), true);
    };

    function as_atom_node() {
        var tok = S.token, ret;
        switch (tok.type) {
          case "name":
          case "keyword":
            ret = _make_symbol(AST_SymbolRef);
            break;
          case "num":
            ret = new AST_Number({ start: tok, end: tok, value: tok.value });
            break;
          case "string":
            ret = new AST_String({ start: tok, end: tok, value: tok.value });
            break;
          case "regexp":
            ret = new AST_RegExp({ start: tok, end: tok, value: tok.value });
            break;
          case "atom":
            switch (tok.value) {
              case "false":
                ret = new AST_False({ start: tok, end: tok });
                break;
              case "true":
                ret = new AST_True({ start: tok, end: tok });
                break;
              case "null":
                ret = new AST_Null({ start: tok, end: tok });
                break;
            }
            break;
        }
        next();
        return ret;
    };

    var expr_atom = function(allow_calls) {
        if (is("operator", "new")) {
            return new_();
        }
        var start = S.token;
        if (is("punc")) {
            switch (start.value) {
              case "(":
                next();
                var ex = expression(true);
                ex.start = start;
                ex.end = S.token;
                expect(")");
                return subscripts(ex, allow_calls);
              case "[":
                return subscripts(array_(), allow_calls);
              case "{":
                return subscripts(object_(), allow_calls);
            }
            unexpected();
        }
        if (is("keyword", "function")) {
            next();
            var func = function_(AST_Function);
            func.start = start;
            func.end = prev();
            return subscripts(func, allow_calls);
        }
        if (ATOMIC_START_TOKEN[S.token.type]) {
            return subscripts(as_atom_node(), allow_calls);
        }
        unexpected();
    };

    function expr_list(closing, allow_trailing_comma, allow_empty) {
        var first = true, a = [];
        while (!is("punc", closing)) {
            if (first) first = false; else expect(",");
            if (allow_trailing_comma && is("punc", closing)) break;
            if (is("punc", ",") && allow_empty) {
                a.push(new AST_Hole({ start: S.token, end: S.token }));
            } else {
                a.push(expression(false));
            }
        }
        next();
        return a;
    };

    var array_ = embed_tokens(function() {
        expect("[");
        return new AST_Array({
            elements: expr_list("]", !options.strict, true)
        });
    });

    var object_ = embed_tokens(function() {
        expect("{");
        var first = true, a = [];
        while (!is("punc", "}")) {
            if (first) first = false; else expect(",");
            if (!options.strict && is("punc", "}"))
                // allow trailing comma
                break;
            var start = S.token;
            var type = start.type;
            var name = as_property_name();
            if (type == "name" && !is("punc", ":")) {
                if (name == "get") {
                    a.push(new AST_ObjectGetter({
                        start : start,
                        key   : as_atom_node(),
                        value : function_(AST_Accessor),
                        end   : prev()
                    }));
                    continue;
                }
                if (name == "set") {
                    a.push(new AST_ObjectSetter({
                        start : start,
                        key   : as_atom_node(),
                        value : function_(AST_Accessor),
                        end   : prev()
                    }));
                    continue;
                }
            }
            expect(":");
            a.push(new AST_ObjectKeyVal({
                start : start,
                key   : name,
                value : expression(false),
                end   : prev()
            }));
        }
        next();
        return new AST_Object({ properties: a });
    });

    function as_property_name() {
        var tmp = S.token;
        next();
        switch (tmp.type) {
          case "num":
          case "string":
          case "name":
          case "operator":
          case "keyword":
          case "atom":
            return tmp.value;
          default:
            unexpected();
        }
    };

    function as_name() {
        var tmp = S.token;
        next();
        switch (tmp.type) {
          case "name":
          case "operator":
          case "keyword":
          case "atom":
            return tmp.value;
          default:
            unexpected();
        }
    };

    function _make_symbol(type) {
        var name = S.token.value;
        return new (name == "this" ? AST_This : type)({
            name  : String(name),
            start : S.token,
            end   : S.token
        });
    };

    function as_symbol(type, noerror) {
        if (!is("name")) {
            if (!noerror) croak("Name expected");
            return null;
        }
        var sym = _make_symbol(type);
        next();
        return sym;
    };

    var subscripts = function(expr, allow_calls) {
        var start = expr.start;
        if (is("punc", ".")) {
            next();
            return subscripts(new AST_Dot({
                start      : start,
                expression : expr,
                property   : as_name(),
                end        : prev()
            }), allow_calls);
        }
        if (is("punc", "[")) {
            next();
            var prop = expression(true);
            expect("]");
            return subscripts(new AST_Sub({
                start      : start,
                expression : expr,
                property   : prop,
                end        : prev()
            }), allow_calls);
        }
        if (allow_calls && is("punc", "(")) {
            next();
            return subscripts(new AST_Call({
                start      : start,
                expression : expr,
                args       : expr_list(")"),
                end        : prev()
            }), true);
        }
        return expr;
    };

    var maybe_unary = function(allow_calls) {
        var start = S.token;
        if (is("operator") && UNARY_PREFIX(start.value)) {
            next();
            handle_regexp();
            var ex = make_unary(AST_UnaryPrefix, start.value, maybe_unary(allow_calls));
            ex.start = start;
            ex.end = prev();
            return ex;
        }
        var val = expr_atom(allow_calls);
        while (is("operator") && UNARY_POSTFIX(S.token.value) && !S.token.nlb) {
            val = make_unary(AST_UnaryPostfix, S.token.value, val);
            val.start = start;
            val.end = S.token;
            next();
        }
        return val;
    };

    function make_unary(ctor, op, expr) {
        if ((op == "++" || op == "--") && !is_assignable(expr))
            croak("Invalid use of " + op + " operator");
        return new ctor({ operator: op, expression: expr });
    };

    var expr_op = function(left, min_prec, no_in) {
        var op = is("operator") ? S.token.value : null;
        if (op == "in" && no_in) op = null;
        var prec = op != null ? PRECEDENCE[op] : null;
        if (prec != null && prec > min_prec) {
            next();
            var right = expr_op(maybe_unary(true), prec, no_in);
            return expr_op(new AST_Binary({
                start    : left.start,
                left     : left,
                operator : op,
                right    : right,
                end      : right.end
            }), min_prec, no_in);
        }
        return left;
    };

    function expr_ops(no_in) {
        return expr_op(maybe_unary(true), 0, no_in);
    };

    var maybe_conditional = function(no_in) {
        var start = S.token;
        var expr = expr_ops(no_in);
        if (is("operator", "?")) {
            next();
            var yes = expression(false);
            expect(":");
            return new AST_Conditional({
                start       : start,
                condition   : expr,
                consequent  : yes,
                alternative : expression(false, no_in),
                end         : prev()
            });
        }
        return expr;
    };

    function is_assignable(expr) {
        if (!options.strict) return true;
        if (expr instanceof AST_This) return false;
        return (expr instanceof AST_PropAccess || expr instanceof AST_Symbol);
    };

    var maybe_assign = function(no_in) {
        var start = S.token;
        var left = maybe_conditional(no_in), val = S.token.value;
        if (is("operator") && ASSIGNMENT(val)) {
            if (is_assignable(left)) {
                next();
                return new AST_Assign({
                    start    : start,
                    left     : left,
                    operator : val,
                    right    : maybe_assign(no_in),
                    end      : prev()
                });
            }
            croak("Invalid assignment");
        }
        return left;
    };

    var expression = function(commas, no_in) {
        var start = S.token;
        var expr = maybe_assign(no_in);
        if (commas && is("punc", ",")) {
            next();
            return new AST_Seq({
                start  : start,
                car    : expr,
                cdr    : expression(true, no_in),
                end    : peek()
            });
        }
        return expr;
    };

    function in_loop(cont) {
        ++S.in_loop;
        var ret = cont();
        --S.in_loop;
        return ret;
    };

    if (options.expression) {
        return expression(true);
    }

    return (function(){
        var start = S.token;
        var body = [];
        while (!is("eof"))
            body.push(statement());
        var end = prev();
        var toplevel = options.toplevel;
        if (toplevel) {
            toplevel.body = toplevel.body.concat(body);
            toplevel.end = end;
        } else {
            toplevel = new AST_Toplevel({ start: start, body: body, end: end });
        }
        return toplevel;
    })();

};

/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS2

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

// Tree transformer helpers.

function TreeTransformer(before, after) {
    TreeWalker.call(this);
    this.before = before;
    this.after = after;
}
TreeTransformer.prototype = new TreeWalker;

(function(undefined){

    function _(node, descend) {
        node.DEFMETHOD("transform", function(tw, in_list){
            var x, y;
            tw.push(this);
            if (tw.before) x = tw.before(this, descend, in_list);
            if (x === undefined) {
                if (!tw.after) {
                    x = this;
                    descend(x, tw);
                } else {
                    tw.stack[tw.stack.length - 1] = x = this.clone();
                    descend(x, tw);
                    y = tw.after(x, in_list);
                    if (y !== undefined) x = y;
                }
            }
            tw.pop();
            return x;
        });
    };

    function do_list(list, tw) {
        return MAP(list, function(node){
            return node.transform(tw, true);
        });
    };

    _(AST_Node, noop);

    _(AST_LabeledStatement, function(self, tw){
        self.label = self.label.transform(tw);
        self.body = self.body.transform(tw);
    });

    _(AST_SimpleStatement, function(self, tw){
        self.body = self.body.transform(tw);
    });

    _(AST_Block, function(self, tw){
        self.body = do_list(self.body, tw);
    });

    _(AST_DWLoop, function(self, tw){
        self.condition = self.condition.transform(tw);
        self.body = self.body.transform(tw);
    });

    _(AST_For, function(self, tw){
        if (self.init) self.init = self.init.transform(tw);
        if (self.condition) self.condition = self.condition.transform(tw);
        if (self.step) self.step = self.step.transform(tw);
        self.body = self.body.transform(tw);
    });

    _(AST_ForIn, function(self, tw){
        self.init = self.init.transform(tw);
        self.object = self.object.transform(tw);
        self.body = self.body.transform(tw);
    });

    _(AST_With, function(self, tw){
        self.expression = self.expression.transform(tw);
        self.body = self.body.transform(tw);
    });

    _(AST_Exit, function(self, tw){
        if (self.value) self.value = self.value.transform(tw);
    });

    _(AST_LoopControl, function(self, tw){
        if (self.label) self.label = self.label.transform(tw);
    });

    _(AST_If, function(self, tw){
        self.condition = self.condition.transform(tw);
        self.body = self.body.transform(tw);
        if (self.alternative) self.alternative = self.alternative.transform(tw);
    });

    _(AST_Switch, function(self, tw){
        self.expression = self.expression.transform(tw);
        self.body = do_list(self.body, tw);
    });

    _(AST_Case, function(self, tw){
        self.expression = self.expression.transform(tw);
        self.body = do_list(self.body, tw);
    });

    _(AST_Try, function(self, tw){
        self.body = do_list(self.body, tw);
        if (self.bcatch) self.bcatch = self.bcatch.transform(tw);
        if (self.bfinally) self.bfinally = self.bfinally.transform(tw);
    });

    _(AST_Catch, function(self, tw){
        self.argname = self.argname.transform(tw);
        self.body = do_list(self.body, tw);
    });

    _(AST_Definitions, function(self, tw){
        self.definitions = do_list(self.definitions, tw);
    });

    _(AST_VarDef, function(self, tw){
        self.name = self.name.transform(tw);
        if (self.value) self.value = self.value.transform(tw);
    });

    _(AST_Lambda, function(self, tw){
        if (self.name) self.name = self.name.transform(tw);
        self.argnames = do_list(self.argnames, tw);
        self.body = do_list(self.body, tw);
    });

    _(AST_Call, function(self, tw){
        self.expression = self.expression.transform(tw);
        self.args = do_list(self.args, tw);
    });

    _(AST_Seq, function(self, tw){
        self.car = self.car.transform(tw);
        self.cdr = self.cdr.transform(tw);
    });

    _(AST_Dot, function(self, tw){
        self.expression = self.expression.transform(tw);
    });

    _(AST_Sub, function(self, tw){
        self.expression = self.expression.transform(tw);
        self.property = self.property.transform(tw);
    });

    _(AST_Unary, function(self, tw){
        self.expression = self.expression.transform(tw);
    });

    _(AST_Binary, function(self, tw){
        self.left = self.left.transform(tw);
        self.right = self.right.transform(tw);
    });

    _(AST_Conditional, function(self, tw){
        self.condition = self.condition.transform(tw);
        self.consequent = self.consequent.transform(tw);
        self.alternative = self.alternative.transform(tw);
    });

    _(AST_Array, function(self, tw){
        self.elements = do_list(self.elements, tw);
    });

    _(AST_Object, function(self, tw){
        self.properties = do_list(self.properties, tw);
    });

    _(AST_ObjectProperty, function(self, tw){
        self.value = self.value.transform(tw);
    });

})();

/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS2

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

function SymbolDef(scope, index, orig) {
    this.name = orig.name;
    this.orig = [ orig ];
    this.scope = scope;
    this.references = [];
    this.global = false;
    this.mangled_name = null;
    this.undeclared = false;
    this.constant = false;
    this.index = index;
};

SymbolDef.prototype = {
    unmangleable: function(options) {
        return (this.global && !(options && options.toplevel))
            || this.undeclared
            || (!(options && options.eval) && (this.scope.uses_eval || this.scope.uses_with));
    },
    mangle: function(options) {
        if (!this.mangled_name && !this.unmangleable(options)) {
            var s = this.scope;
            if (!options.screw_ie8 && this.orig[0] instanceof AST_SymbolLambda)
                s = s.parent_scope;
            this.mangled_name = s.next_mangled(options, this);
        }
    }
};

AST_Toplevel.DEFMETHOD("figure_out_scope", function(options){
    options = defaults(options, {
        screw_ie8: false
    });

    // pass 1: setup scope chaining and handle definitions
    var self = this;
    var scope = self.parent_scope = null;
    var defun = null;
    var nesting = 0;
    var tw = new TreeWalker(function(node, descend){
        if (options.screw_ie8 && node instanceof AST_Catch) {
            var save_scope = scope;
            scope = new AST_Scope(node);
            scope.init_scope_vars(nesting);
            scope.parent_scope = save_scope;
            descend();
            scope = save_scope;
            return true;
        }
        if (node instanceof AST_Scope) {
            node.init_scope_vars(nesting);
            var save_scope = node.parent_scope = scope;
            var save_defun = defun;
            defun = scope = node;
            ++nesting; descend(); --nesting;
            scope = save_scope;
            defun = save_defun;
            return true;        // don't descend again in TreeWalker
        }
        if (node instanceof AST_Directive) {
            node.scope = scope;
            push_uniq(scope.directives, node.value);
            return true;
        }
        if (node instanceof AST_With) {
            for (var s = scope; s; s = s.parent_scope)
                s.uses_with = true;
            return;
        }
        if (node instanceof AST_Symbol) {
            node.scope = scope;
        }
        if (node instanceof AST_SymbolLambda) {
            defun.def_function(node);
        }
        else if (node instanceof AST_SymbolDefun) {
            // Careful here, the scope where this should be defined is
            // the parent scope.  The reason is that we enter a new
            // scope when we encounter the AST_Defun node (which is
            // instanceof AST_Scope) but we get to the symbol a bit
            // later.
            (node.scope = defun.parent_scope).def_function(node);
        }
        else if (node instanceof AST_SymbolVar
                 || node instanceof AST_SymbolConst) {
            var def = defun.def_variable(node);
            def.constant = node instanceof AST_SymbolConst;
            def.init = tw.parent().value;
        }
        else if (node instanceof AST_SymbolCatch) {
            (options.screw_ie8 ? scope : defun)
                .def_variable(node);
        }
    });
    self.walk(tw);

    // pass 2: find back references and eval
    var func = null;
    var globals = self.globals = new Dictionary();
    var tw = new TreeWalker(function(node, descend){
        if (node instanceof AST_Lambda) {
            var prev_func = func;
            func = node;
            descend();
            func = prev_func;
            return true;
        }
        if (node instanceof AST_SymbolRef) {
            var name = node.name;
            var sym = node.scope.find_variable(name);
            if (!sym) {
                var g;
                if (globals.has(name)) {
                    g = globals.get(name);
                } else {
                    g = new SymbolDef(self, globals.size(), node);
                    g.undeclared = true;
                    g.global = true;
                    globals.set(name, g);
                }
                node.thedef = g;
                if (name == "eval" && tw.parent() instanceof AST_Call) {
                    for (var s = node.scope; s && !s.uses_eval; s = s.parent_scope)
                        s.uses_eval = true;
                }
                if (func && name == "arguments") {
                    func.uses_arguments = true;
                }
            } else {
                node.thedef = sym;
            }
            node.reference();
            return true;
        }
    });
    self.walk(tw);
});

AST_Scope.DEFMETHOD("init_scope_vars", function(nesting){
    this.directives = [];     // contains the directives defined in this scope, i.e. "use strict"
    this.variables = new Dictionary(); // map name to AST_SymbolVar (variables defined in this scope; includes functions)
    this.functions = new Dictionary(); // map name to AST_SymbolDefun (functions defined in this scope)
    this.uses_with = false;   // will be set to true if this or some nested scope uses the `with` statement
    this.uses_eval = false;   // will be set to true if this or nested scope uses the global `eval`
    this.parent_scope = null; // the parent scope
    this.enclosed = [];       // a list of variables from this or outer scope(s) that are referenced from this or inner scopes
    this.cname = -1;          // the current index for mangling functions/variables
    this.nesting = nesting;   // the nesting level of this scope (0 means toplevel)
});

AST_Scope.DEFMETHOD("strict", function(){
    return this.has_directive("use strict");
});

AST_Lambda.DEFMETHOD("init_scope_vars", function(){
    AST_Scope.prototype.init_scope_vars.apply(this, arguments);
    this.uses_arguments = false;
});

AST_SymbolRef.DEFMETHOD("reference", function() {
    var def = this.definition();
    def.references.push(this);
    var s = this.scope;
    while (s) {
        push_uniq(s.enclosed, def);
        if (s === def.scope) break;
        s = s.parent_scope;
    }
    this.frame = this.scope.nesting - def.scope.nesting;
});

AST_Scope.DEFMETHOD("find_variable", function(name){
    if (name instanceof AST_Symbol) name = name.name;
    return this.variables.get(name)
        || (this.parent_scope && this.parent_scope.find_variable(name));
});

AST_Scope.DEFMETHOD("has_directive", function(value){
    return this.parent_scope && this.parent_scope.has_directive(value)
        || (this.directives.indexOf(value) >= 0 ? this : null);
});

AST_Scope.DEFMETHOD("def_function", function(symbol){
    this.functions.set(symbol.name, this.def_variable(symbol));
});

AST_Scope.DEFMETHOD("def_variable", function(symbol){
    var def;
    if (!this.variables.has(symbol.name)) {
        def = new SymbolDef(this, this.variables.size(), symbol);
        this.variables.set(symbol.name, def);
        def.global = !this.parent_scope;
    } else {
        def = this.variables.get(symbol.name);
        def.orig.push(symbol);
    }
    return symbol.thedef = def;
});

AST_Scope.DEFMETHOD("next_mangled", function(options){
    var ext = this.enclosed;
    out: while (true) {
        var m = base54(++this.cname);
        if (!is_identifier(m)) continue; // skip over "do"

        // https://github.com/mishoo/UglifyJS2/issues/242 -- do not
        // shadow a name excepted from mangling.
        if (options.except.indexOf(m) >= 0) continue;

        // we must ensure that the mangled name does not shadow a name
        // from some parent scope that is referenced in this or in
        // inner scopes.
        for (var i = ext.length; --i >= 0;) {
            var sym = ext[i];
            var name = sym.mangled_name || (sym.unmangleable(options) && sym.name);
            if (m == name) continue out;
        }
        return m;
    }
});

AST_Function.DEFMETHOD("next_mangled", function(options, def){
    // #179, #326
    // in Safari strict mode, something like (function x(x){...}) is a syntax error;
    // a function expression's argument cannot shadow the function expression's name

    var tricky_def = def.orig[0] instanceof AST_SymbolFunarg && this.name && this.name.definition();
    while (true) {
        var name = AST_Lambda.prototype.next_mangled.call(this, options, def);
        if (!(tricky_def && tricky_def.mangled_name == name))
            return name;
    }
});

AST_Scope.DEFMETHOD("references", function(sym){
    if (sym instanceof AST_Symbol) sym = sym.definition();
    return this.enclosed.indexOf(sym) < 0 ? null : sym;
});

AST_Symbol.DEFMETHOD("unmangleable", function(options){
    return this.definition().unmangleable(options);
});

// property accessors are not mangleable
AST_SymbolAccessor.DEFMETHOD("unmangleable", function(){
    return true;
});

// labels are always mangleable
AST_Label.DEFMETHOD("unmangleable", function(){
    return false;
});

AST_Symbol.DEFMETHOD("unreferenced", function(){
    return this.definition().references.length == 0
        && !(this.scope.uses_eval || this.scope.uses_with);
});

AST_Symbol.DEFMETHOD("undeclared", function(){
    return this.definition().undeclared;
});

AST_LabelRef.DEFMETHOD("undeclared", function(){
    return false;
});

AST_Label.DEFMETHOD("undeclared", function(){
    return false;
});

AST_Symbol.DEFMETHOD("definition", function(){
    return this.thedef;
});

AST_Symbol.DEFMETHOD("global", function(){
    return this.definition().global;
});

AST_Toplevel.DEFMETHOD("_default_mangler_options", function(options){
    return defaults(options, {
        except   : [],
        eval     : false,
        sort     : false,
        toplevel : false,
        screw_ie8 : false
    });
});

AST_Toplevel.DEFMETHOD("mangle_names", function(options){
    options = this._default_mangler_options(options);
    // We only need to mangle declaration nodes.  Special logic wired
    // into the code generator will display the mangled name if it's
    // present (and for AST_SymbolRef-s it'll use the mangled name of
    // the AST_SymbolDeclaration that it points to).
    var lname = -1;
    var to_mangle = [];
    var tw = new TreeWalker(function(node, descend){
        if (node instanceof AST_LabeledStatement) {
            // lname is incremented when we get to the AST_Label
            var save_nesting = lname;
            descend();
            lname = save_nesting;
            return true;        // don't descend again in TreeWalker
        }
        if (node instanceof AST_Scope) {
            var p = tw.parent(), a = [];
            node.variables.each(function(symbol){
                if (options.except.indexOf(symbol.name) < 0) {
                    a.push(symbol);
                }
            });
            if (options.sort) a.sort(function(a, b){
                return b.references.length - a.references.length;
            });
            to_mangle.push.apply(to_mangle, a);
            return;
        }
        if (node instanceof AST_Label) {
            var name;
            do name = base54(++lname); while (!is_identifier(name));
            node.mangled_name = name;
            return true;
        }
        if (options.screw_ie8 && node instanceof AST_SymbolCatch) {
            to_mangle.push(node.definition());
            return;
        }
    });
    this.walk(tw);
    to_mangle.forEach(function(def){ def.mangle(options) });
});

AST_Toplevel.DEFMETHOD("compute_char_frequency", function(options){
    options = this._default_mangler_options(options);
    var tw = new TreeWalker(function(node){
        if (node instanceof AST_Constant)
            base54.consider(node.print_to_string());
        else if (node instanceof AST_Return)
            base54.consider("return");
        else if (node instanceof AST_Throw)
            base54.consider("throw");
        else if (node instanceof AST_Continue)
            base54.consider("continue");
        else if (node instanceof AST_Break)
            base54.consider("break");
        else if (node instanceof AST_Debugger)
            base54.consider("debugger");
        else if (node instanceof AST_Directive)
            base54.consider(node.value);
        else if (node instanceof AST_While)
            base54.consider("while");
        else if (node instanceof AST_Do)
            base54.consider("do while");
        else if (node instanceof AST_If) {
            base54.consider("if");
            if (node.alternative) base54.consider("else");
        }
        else if (node instanceof AST_Var)
            base54.consider("var");
        else if (node instanceof AST_Const)
            base54.consider("const");
        else if (node instanceof AST_Lambda)
            base54.consider("function");
        else if (node instanceof AST_For)
            base54.consider("fo" + "r");
        else if (node instanceof AST_ForIn)
            base54.consider("for in");
        else if (node instanceof AST_Switch)
            base54.consider("switch");
        else if (node instanceof AST_Case)
            base54.consider("case");
        else if (node instanceof AST_Default)
            base54.consider("default");
        else if (node instanceof AST_With)
            base54.consider("with");
        else if (node instanceof AST_ObjectSetter)
            base54.consider("set" + node.key);
        else if (node instanceof AST_ObjectGetter)
            base54.consider("get" + node.key);
        else if (node instanceof AST_ObjectKeyVal)
            base54.consider(node.key);
        else if (node instanceof AST_New)
            base54.consider("new");
        else if (node instanceof AST_This)
            base54.consider("this");
        else if (node instanceof AST_Try)
            base54.consider("try");
        else if (node instanceof AST_Catch)
            base54.consider("catch");
        else if (node instanceof AST_Finally)
            base54.consider("finally");
        else if (node instanceof AST_Symbol && node.unmangleable(options))
            base54.consider(node.name);
        else if (node instanceof AST_Unary || node instanceof AST_Binary)
            base54.consider(node.operator);
        else if (node instanceof AST_Dot)
            base54.consider(node.property);
    });
    this.walk(tw);
    base54.sort();
});

var base54 = (function() {
    var string = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_0123456789";
    var chars, frequency;
    function reset() {
        frequency = Object.create(null);
        chars = string.split("").map(function(ch){ return ch.charCodeAt(0) });
        chars.forEach(function(ch){ frequency[ch] = 0 });
    }
    base54.consider = function(str){
        for (var i = str.length; --i >= 0;) {
            var code = str.charCodeAt(i);
            if (code in frequency) ++frequency[code];
        }
    };
    base54.sort = function() {
        chars = mergeSort(chars, function(a, b){
            if (is_digit(a) && !is_digit(b)) return 1;
            if (is_digit(b) && !is_digit(a)) return -1;
            return frequency[b] - frequency[a];
        });
    };
    base54.reset = reset;
    reset();
    base54.get = function(){ return chars };
    base54.freq = function(){ return frequency };
    function base54(num) {
        var ret = "", base = 54;
        do {
            ret += String.fromCharCode(chars[num % base]);
            num = Math.floor(num / base);
            base = 64;
        } while (num > 0);
        return ret;
    };
    return base54;
})();

AST_Toplevel.DEFMETHOD("scope_warnings", function(options){
    options = defaults(options, {
        undeclared       : false, // this makes a lot of noise
        unreferenced     : true,
        assign_to_global : true,
        func_arguments   : true,
        nested_defuns    : true,
        eval             : true
    });
    var tw = new TreeWalker(function(node){
        if (options.undeclared
            && node instanceof AST_SymbolRef
            && node.undeclared())
        {
            // XXX: this also warns about JS standard names,
            // i.e. Object, Array, parseInt etc.  Should add a list of
            // exceptions.
            AST_Node.warn("Undeclared symbol: {name} [{file}:{line},{col}]", {
                name: node.name,
                file: node.start.file,
                line: node.start.line,
                col: node.start.col
            });
        }
        if (options.assign_to_global)
        {
            var sym = null;
            if (node instanceof AST_Assign && node.left instanceof AST_SymbolRef)
                sym = node.left;
            else if (node instanceof AST_ForIn && node.init instanceof AST_SymbolRef)
                sym = node.init;
            if (sym
                && (sym.undeclared()
                    || (sym.global() && sym.scope !== sym.definition().scope))) {
                AST_Node.warn("{msg}: {name} [{file}:{line},{col}]", {
                    msg: sym.undeclared() ? "Accidental global?" : "Assignment to global",
                    name: sym.name,
                    file: sym.start.file,
                    line: sym.start.line,
                    col: sym.start.col
                });
            }
        }
        if (options.eval
            && node instanceof AST_SymbolRef
            && node.undeclared()
            && node.name == "eval") {
            AST_Node.warn("Eval is used [{file}:{line},{col}]", node.start);
        }
        if (options.unreferenced
            && (node instanceof AST_SymbolDeclaration || node instanceof AST_Label)
            && node.unreferenced()) {
            AST_Node.warn("{type} {name} is declared but not referenced [{file}:{line},{col}]", {
                type: node instanceof AST_Label ? "Label" : "Symbol",
                name: node.name,
                file: node.start.file,
                line: node.start.line,
                col: node.start.col
            });
        }
        if (options.func_arguments
            && node instanceof AST_Lambda
            && node.uses_arguments) {
            AST_Node.warn("arguments used in function {name} [{file}:{line},{col}]", {
                name: node.name ? node.name.name : "anonymous",
                file: node.start.file,
                line: node.start.line,
                col: node.start.col
            });
        }
        if (options.nested_defuns
            && node instanceof AST_Defun
            && !(tw.parent() instanceof AST_Scope)) {
            AST_Node.warn("Function {name} declared in nested statement \"{type}\" [{file}:{line},{col}]", {
                name: node.name.name,
                type: tw.parent().TYPE,
                file: node.start.file,
                line: node.start.line,
                col: node.start.col
            });
        }
    });
    this.walk(tw);
});

/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS2

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

function OutputStream(options) {

    options = defaults(options, {
        indent_start     : 0,
        indent_level     : 4,
        quote_keys       : false,
        space_colon      : true,
        ascii_only       : false,
        unescape_regexps : false,
        inline_script    : false,
        width            : 80,
        max_line_len     : 32000,
        beautify         : false,
        source_map       : null,
        bracketize       : false,
        semicolons       : true,
        comments         : false,
        preserve_line    : false,
        screw_ie8        : false,
        preamble         : null,
    }, true);

    var indentation = 0;
    var current_col = 0;
    var current_line = 1;
    var current_pos = 0;
    var OUTPUT = "";

    function to_ascii(str, identifier) {
        return str.replace(/[\u0080-\uffff]/g, function(ch) {
            var code = ch.charCodeAt(0).toString(16);
            if (code.length <= 2 && !identifier) {
                while (code.length < 2) code = "0" + code;
                return "\\x" + code;
            } else {
                while (code.length < 4) code = "0" + code;
                return "\\u" + code;
            }
        });
    };

    function make_string(str) {
        var dq = 0, sq = 0;
        str = str.replace(/[\\\b\f\n\r\t\x22\x27\u2028\u2029\0]/g, function(s){
            switch (s) {
              case "\\": return "\\\\";
              case "\b": return "\\b";
              case "\f": return "\\f";
              case "\n": return "\\n";
              case "\r": return "\\r";
              case "\u2028": return "\\u2028";
              case "\u2029": return "\\u2029";
              case '"': ++dq; return '"';
              case "'": ++sq; return "'";
              case "\0": return "\\x00";
            }
            return s;
        });
        if (options.ascii_only) str = to_ascii(str);
        if (dq > sq) return "'" + str.replace(/\x27/g, "\\'") + "'";
        else return '"' + str.replace(/\x22/g, '\\"') + '"';
    };

    function encode_string(str) {
        var ret = make_string(str);
        if (options.inline_script)
            ret = ret.replace(/<\x2fscript([>\/\t\n\f\r ])/gi, "<\\/script$1");
        return ret;
    };

    function make_name(name) {
        name = name.toString();
        if (options.ascii_only)
            name = to_ascii(name, true);
        return name;
    };

    function make_indent(back) {
        return repeat_string(" ", options.indent_start + indentation - back * options.indent_level);
    };

    /* -----[ beautification/minification ]----- */

    var might_need_space = false;
    var might_need_semicolon = false;
    var last = null;

    function last_char() {
        return last.charAt(last.length - 1);
    };

    function maybe_newline() {
        if (options.max_line_len && current_col > options.max_line_len)
            print("\n");
    };

    var requireSemicolonChars = makePredicate("( [ + * / - , .");

    function print(str) {
        str = String(str);
        var ch = str.charAt(0);
        if (might_need_semicolon) {
            if ((!ch || ";}".indexOf(ch) < 0) && !/[;]$/.test(last)) {
                if (options.semicolons || requireSemicolonChars(ch)) {
                    OUTPUT += ";";
                    current_col++;
                    current_pos++;
                } else {
                    OUTPUT += "\n";
                    current_pos++;
                    current_line++;
                    current_col = 0;
                }
                if (!options.beautify)
                    might_need_space = false;
            }
            might_need_semicolon = false;
            maybe_newline();
        }

        if (!options.beautify && options.preserve_line && stack[stack.length - 1]) {
            var target_line = stack[stack.length - 1].start.line;
            while (current_line < target_line) {
                OUTPUT += "\n";
                current_pos++;
                current_line++;
                current_col = 0;
                might_need_space = false;
            }
        }

        if (might_need_space) {
            var prev = last_char();
            if ((is_identifier_char(prev)
                 && (is_identifier_char(ch) || ch == "\\"))
                || (/^[\+\-\/]$/.test(ch) && ch == prev))
            {
                OUTPUT += " ";
                current_col++;
                current_pos++;
            }
            might_need_space = false;
        }
        var a = str.split(/\r?\n/), n = a.length - 1;
        current_line += n;
        if (n == 0) {
            current_col += a[n].length;
        } else {
            current_col = a[n].length;
        }
        current_pos += str.length;
        last = str;
        OUTPUT += str;
    };

    var space = options.beautify ? function() {
        print(" ");
    } : function() {
        might_need_space = true;
    };

    var indent = options.beautify ? function(half) {
        if (options.beautify) {
            print(make_indent(half ? 0.5 : 0));
        }
    } : noop;

    var with_indent = options.beautify ? function(col, cont) {
        if (col === true) col = next_indent();
        var save_indentation = indentation;
        indentation = col;
        var ret = cont();
        indentation = save_indentation;
        return ret;
    } : function(col, cont) { return cont() };

    var newline = options.beautify ? function() {
        print("\n");
    } : noop;

    var semicolon = options.beautify ? function() {
        print(";");
    } : function() {
        might_need_semicolon = true;
    };

    function force_semicolon() {
        might_need_semicolon = false;
        print(";");
    };

    function next_indent() {
        return indentation + options.indent_level;
    };

    function with_block(cont) {
        var ret;
        print("{");
        newline();
        with_indent(next_indent(), function(){
            ret = cont();
        });
        indent();
        print("}");
        return ret;
    };

    function with_parens(cont) {
        print("(");
        //XXX: still nice to have that for argument lists
        //var ret = with_indent(current_col, cont);
        var ret = cont();
        print(")");
        return ret;
    };

    function with_square(cont) {
        print("[");
        //var ret = with_indent(current_col, cont);
        var ret = cont();
        print("]");
        return ret;
    };

    function comma() {
        print(",");
        space();
    };

    function colon() {
        print(":");
        if (options.space_colon) space();
    };

    var add_mapping = options.source_map ? function(token, name) {
        try {
            if (token) options.source_map.add(
                token.file || "?",
                current_line, current_col,
                token.line, token.col,
                (!name && token.type == "name") ? token.value : name
            );
        } catch(ex) {
            AST_Node.warn("Couldn't figure out mapping for {file}:{line},{col} → {cline},{ccol} [{name}]", {
                file: token.file,
                line: token.line,
                col: token.col,
                cline: current_line,
                ccol: current_col,
                name: name || ""
            })
        }
    } : noop;

    function get() {
        return OUTPUT;
    };

    if (options.preamble) {
        print(options.preamble.replace(/\r\n?|[\n\u2028\u2029]|\s*$/g, "\n"));
    }

    var stack = [];
    return {
        get             : get,
        toString        : get,
        indent          : indent,
        indentation     : function() { return indentation },
        current_width   : function() { return current_col - indentation },
        should_break    : function() { return options.width && this.current_width() >= options.width },
        newline         : newline,
        print           : print,
        space           : space,
        comma           : comma,
        colon           : colon,
        last            : function() { return last },
        semicolon       : semicolon,
        force_semicolon : force_semicolon,
        to_ascii        : to_ascii,
        print_name      : function(name) { print(make_name(name)) },
        print_string    : function(str) { print(encode_string(str)) },
        next_indent     : next_indent,
        with_indent     : with_indent,
        with_block      : with_block,
        with_parens     : with_parens,
        with_square     : with_square,
        add_mapping     : add_mapping,
        option          : function(opt) { return options[opt] },
        line            : function() { return current_line },
        col             : function() { return current_col },
        pos             : function() { return current_pos },
        push_node       : function(node) { stack.push(node) },
        pop_node        : function() { return stack.pop() },
        stack           : function() { return stack },
        parent          : function(n) {
            return stack[stack.length - 2 - (n || 0)];
        }
    };

};

/* -----[ code generators ]----- */

(function(){

    /* -----[ utils ]----- */

    function DEFPRINT(nodetype, generator) {
        nodetype.DEFMETHOD("_codegen", generator);
    };

    AST_Node.DEFMETHOD("print", function(stream, force_parens){
        var self = this, generator = self._codegen;
        function doit() {
            self.add_comments(stream);
            self.add_source_map(stream);
            generator(self, stream);
        }
        stream.push_node(self);
        if (force_parens || self.needs_parens(stream)) {
            stream.with_parens(doit);
        } else {
            doit();
        }
        stream.pop_node();
    });

    AST_Node.DEFMETHOD("print_to_string", function(options){
        var s = OutputStream(options);
        this.print(s);
        return s.get();
    });

    /* -----[ comments ]----- */

    AST_Node.DEFMETHOD("add_comments", function(output){
        var c = output.option("comments"), self = this;
        if (c) {
            var start = self.start;
            if (start && !start._comments_dumped) {
                start._comments_dumped = true;
                var comments = start.comments_before || [];

                // XXX: ugly fix for https://github.com/mishoo/UglifyJS2/issues/112
                //               and https://github.com/mishoo/UglifyJS2/issues/372
                if (self instanceof AST_Exit && self.value) {
                    self.value.walk(new TreeWalker(function(node){
                        if (node.start && node.start.comments_before) {
                            comments = comments.concat(node.start.comments_before);
                            node.start.comments_before = [];
                        }
                        if (node instanceof AST_Function ||
                            node instanceof AST_Array ||
                            node instanceof AST_Object)
                        {
                            return true; // don't go inside.
                        }
                    }));
                }

                if (c.test) {
                    comments = comments.filter(function(comment){
                        return c.test(comment.value);
                    });
                } else if (typeof c == "function") {
                    comments = comments.filter(function(comment){
                        return c(self, comment);
                    });
                }
                comments.forEach(function(c){
                    if (/comment[134]/.test(c.type)) {
                        output.print("//" + c.value + "\n");
                        output.indent();
                    }
                    else if (c.type == "comment2") {
                        output.print("/*" + c.value + "*/");
                        if (start.nlb) {
                            output.print("\n");
                            output.indent();
                        } else {
                            output.space();
                        }
                    }
                });
            }
        }
    });

    /* -----[ PARENTHESES ]----- */

    function PARENS(nodetype, func) {
        nodetype.DEFMETHOD("needs_parens", func);
    };

    PARENS(AST_Node, function(){
        return false;
    });

    // a function expression needs parens around it when it's provably
    // the first token to appear in a statement.
    PARENS(AST_Function, function(output){
        return first_in_statement(output);
    });

    // same goes for an object literal, because otherwise it would be
    // interpreted as a block of code.
    PARENS(AST_Object, function(output){
        return first_in_statement(output);
    });

    PARENS(AST_Unary, function(output){
        var p = output.parent();
        return p instanceof AST_PropAccess && p.expression === this;
    });

    PARENS(AST_Seq, function(output){
        var p = output.parent();
        return p instanceof AST_Call             // (foo, bar)() or foo(1, (2, 3), 4)
            || p instanceof AST_Unary            // !(foo, bar, baz)
            || p instanceof AST_Binary           // 1 + (2, 3) + 4 ==> 8
            || p instanceof AST_VarDef           // var a = (1, 2), b = a + a; ==> b == 4
            || p instanceof AST_PropAccess       // (1, {foo:2}).foo or (1, {foo:2})["foo"] ==> 2
            || p instanceof AST_Array            // [ 1, (2, 3), 4 ] ==> [ 1, 3, 4 ]
            || p instanceof AST_ObjectProperty   // { foo: (1, 2) }.foo ==> 2
            || p instanceof AST_Conditional      /* (false, true) ? (a = 10, b = 20) : (c = 30)
                                                  * ==> 20 (side effect, set a := 10 and b := 20) */
        ;
    });

    PARENS(AST_Binary, function(output){
        var p = output.parent();
        // (foo && bar)()
        if (p instanceof AST_Call && p.expression === this)
            return true;
        // typeof (foo && bar)
        if (p instanceof AST_Unary)
            return true;
        // (foo && bar)["prop"], (foo && bar).prop
        if (p instanceof AST_PropAccess && p.expression === this)
            return true;
        // this deals with precedence: 3 * (2 + 1)
        if (p instanceof AST_Binary) {
            var po = p.operator, pp = PRECEDENCE[po];
            var so = this.operator, sp = PRECEDENCE[so];
            if (pp > sp
                || (pp == sp
                    && this === p.right)) {
                return true;
            }
        }
    });

    PARENS(AST_PropAccess, function(output){
        var p = output.parent();
        if (p instanceof AST_New && p.expression === this) {
            // i.e. new (foo.bar().baz)
            //
            // if there's one call into this subtree, then we need
            // parens around it too, otherwise the call will be
            // interpreted as passing the arguments to the upper New
            // expression.
            try {
                this.walk(new TreeWalker(function(node){
                    if (node instanceof AST_Call) throw p;
                }));
            } catch(ex) {
                if (ex !== p) throw ex;
                return true;
            }
        }
    });

    PARENS(AST_Call, function(output){
        var p = output.parent(), p1;
        if (p instanceof AST_New && p.expression === this)
            return true;

        // workaround for Safari bug.
        // https://bugs.webkit.org/show_bug.cgi?id=123506
        return this.expression instanceof AST_Function
            && p instanceof AST_PropAccess
            && p.expression === this
            && (p1 = output.parent(1)) instanceof AST_Assign
            && p1.left === p;
    });

    PARENS(AST_New, function(output){
        var p = output.parent();
        if (no_constructor_parens(this, output)
            && (p instanceof AST_PropAccess // (new Date).getTime(), (new Date)["getTime"]()
                || p instanceof AST_Call && p.expression === this)) // (new foo)(bar)
            return true;
    });

    PARENS(AST_Number, function(output){
        var p = output.parent();
        if (this.getValue() < 0 && p instanceof AST_PropAccess && p.expression === this)
            return true;
    });

    PARENS(AST_NaN, function(output){
        var p = output.parent();
        if (p instanceof AST_PropAccess && p.expression === this)
            return true;
    });

    function assign_and_conditional_paren_rules(output) {
        var p = output.parent();
        // !(a = false) → true
        if (p instanceof AST_Unary)
            return true;
        // 1 + (a = 2) + 3 → 6, side effect setting a = 2
        if (p instanceof AST_Binary && !(p instanceof AST_Assign))
            return true;
        // (a = func)() —or— new (a = Object)()
        if (p instanceof AST_Call && p.expression === this)
            return true;
        // (a = foo) ? bar : baz
        if (p instanceof AST_Conditional && p.condition === this)
            return true;
        // (a = foo)["prop"] —or— (a = foo).prop
        if (p instanceof AST_PropAccess && p.expression === this)
            return true;
    };

    PARENS(AST_Assign, assign_and_conditional_paren_rules);
    PARENS(AST_Conditional, assign_and_conditional_paren_rules);

    /* -----[ PRINTERS ]----- */

    DEFPRINT(AST_Directive, function(self, output){
        output.print_string(self.value);
        output.semicolon();
    });
    DEFPRINT(AST_Debugger, function(self, output){
        output.print("debugger");
        output.semicolon();
    });

    /* -----[ statements ]----- */

    function display_body(body, is_toplevel, output) {
        var last = body.length - 1;
        body.forEach(function(stmt, i){
            if (!(stmt instanceof AST_EmptyStatement)) {
                output.indent();
                stmt.print(output);
                if (!(i == last && is_toplevel)) {
                    output.newline();
                    if (is_toplevel) output.newline();
                }
            }
        });
    };

    AST_StatementWithBody.DEFMETHOD("_do_print_body", function(output){
        force_statement(this.body, output);
    });

    DEFPRINT(AST_Statement, function(self, output){
        self.body.print(output);
        output.semicolon();
    });
    DEFPRINT(AST_Toplevel, function(self, output){
        display_body(self.body, true, output);
        output.print("");
    });
    DEFPRINT(AST_LabeledStatement, function(self, output){
        self.label.print(output);
        output.colon();
        self.body.print(output);
    });
    DEFPRINT(AST_SimpleStatement, function(self, output){
        self.body.print(output);
        output.semicolon();
    });
    function print_bracketed(body, output) {
        if (body.length > 0) output.with_block(function(){
            display_body(body, false, output);
        });
        else output.print("{}");
    };
    DEFPRINT(AST_BlockStatement, function(self, output){
        print_bracketed(self.body, output);
    });
    DEFPRINT(AST_EmptyStatement, function(self, output){
        output.semicolon();
    });
    DEFPRINT(AST_Do, function(self, output){
        output.print("do");
        output.space();
        self._do_print_body(output);
        output.space();
        output.print("while");
        output.space();
        output.with_parens(function(){
            self.condition.print(output);
        });
        output.semicolon();
    });
    DEFPRINT(AST_While, function(self, output){
        output.print("while");
        output.space();
        output.with_parens(function(){
            self.condition.print(output);
        });
        output.space();
        self._do_print_body(output);
    });
    DEFPRINT(AST_For, function(self, output){
        output.print("fo" + "r");
        output.space();
        output.with_parens(function(){
            if (self.init && !(self.init instanceof AST_EmptyStatement)) {
                if (self.init instanceof AST_Definitions) {
                    self.init.print(output);
                } else {
                    parenthesize_for_noin(self.init, output, true);
                }
                output.print(";");
                output.space();
            } else {
                output.print(";");
            }
            if (self.condition) {
                self.condition.print(output);
                output.print(";");
                output.space();
            } else {
                output.print(";");
            }
            if (self.step) {
                self.step.print(output);
            }
        });
        output.space();
        self._do_print_body(output);
    });
    DEFPRINT(AST_ForIn, function(self, output){
        output.print("fo" + "r");
        output.space();
        output.with_parens(function(){
            self.init.print(output);
            output.space();
            output.print("in");
            output.space();
            self.object.print(output);
        });
        output.space();
        self._do_print_body(output);
    });
    DEFPRINT(AST_With, function(self, output){
        output.print("with");
        output.space();
        output.with_parens(function(){
            self.expression.print(output);
        });
        output.space();
        self._do_print_body(output);
    });

    /* -----[ functions ]----- */
    AST_Lambda.DEFMETHOD("_do_print", function(output, nokeyword){
        var self = this;
        if (!nokeyword) {
            output.print("function");
        }
        if (self.name) {
            output.space();
            self.name.print(output);
        }
        output.with_parens(function(){
            self.argnames.forEach(function(arg, i){
                if (i) output.comma();
                arg.print(output);
            });
        });
        output.space();
        print_bracketed(self.body, output);
    });
    DEFPRINT(AST_Lambda, function(self, output){
        self._do_print(output);
    });

    /* -----[ exits ]----- */
    AST_Exit.DEFMETHOD("_do_print", function(output, kind){
        output.print(kind);
        if (this.value) {
            output.space();
            this.value.print(output);
        }
        output.semicolon();
    });
    DEFPRINT(AST_Return, function(self, output){
        self._do_print(output, "return");
    });
    DEFPRINT(AST_Throw, function(self, output){
        self._do_print(output, "throw");
    });

    /* -----[ loop control ]----- */
    AST_LoopControl.DEFMETHOD("_do_print", function(output, kind){
        output.print(kind);
        if (this.label) {
            output.space();
            this.label.print(output);
        }
        output.semicolon();
    });
    DEFPRINT(AST_Break, function(self, output){
        self._do_print(output, "break");
    });
    DEFPRINT(AST_Continue, function(self, output){
        self._do_print(output, "continue");
    });

    /* -----[ if ]----- */
    function make_then(self, output) {
        if (output.option("bracketize")) {
            make_block(self.body, output);
            return;
        }
        // The squeezer replaces "block"-s that contain only a single
        // statement with the statement itself; technically, the AST
        // is correct, but this can create problems when we output an
        // IF having an ELSE clause where the THEN clause ends in an
        // IF *without* an ELSE block (then the outer ELSE would refer
        // to the inner IF).  This function checks for this case and
        // adds the block brackets if needed.
        if (!self.body)
            return output.force_semicolon();
        if (self.body instanceof AST_Do
            && !output.option("screw_ie8")) {
            // https://github.com/mishoo/UglifyJS/issues/#issue/57 IE
            // croaks with "syntax error" on code like this: if (foo)
            // do ... while(cond); else ...  we need block brackets
            // around do/while
            make_block(self.body, output);
            return;
        }
        var b = self.body;
        while (true) {
            if (b instanceof AST_If) {
                if (!b.alternative) {
                    make_block(self.body, output);
                    return;
                }
                b = b.alternative;
            }
            else if (b instanceof AST_StatementWithBody) {
                b = b.body;
            }
            else break;
        }
        force_statement(self.body, output);
    };
    DEFPRINT(AST_If, function(self, output){
        output.print("if");
        output.space();
        output.with_parens(function(){
            self.condition.print(output);
        });
        output.space();
        if (self.alternative) {
            make_then(self, output);
            output.space();
            output.print("else");
            output.space();
            force_statement(self.alternative, output);
        } else {
            self._do_print_body(output);
        }
    });

    /* -----[ switch ]----- */
    DEFPRINT(AST_Switch, function(self, output){
        output.print("switch");
        output.space();
        output.with_parens(function(){
            self.expression.print(output);
        });
        output.space();
        if (self.body.length > 0) output.with_block(function(){
            self.body.forEach(function(stmt, i){
                if (i) output.newline();
                output.indent(true);
                stmt.print(output);
            });
        });
        else output.print("{}");
    });
    AST_SwitchBranch.DEFMETHOD("_do_print_body", function(output){
        if (this.body.length > 0) {
            output.newline();
            this.body.forEach(function(stmt){
                output.indent();
                stmt.print(output);
                output.newline();
            });
        }
    });
    DEFPRINT(AST_Default, function(self, output){
        output.print("default:");
        self._do_print_body(output);
    });
    DEFPRINT(AST_Case, function(self, output){
        output.print("case");
        output.space();
        self.expression.print(output);
        output.print(":");
        self._do_print_body(output);
    });

    /* -----[ exceptions ]----- */
    DEFPRINT(AST_Try, function(self, output){
        output.print("try");
        output.space();
        print_bracketed(self.body, output);
        if (self.bcatch) {
            output.space();
            self.bcatch.print(output);
        }
        if (self.bfinally) {
            output.space();
            self.bfinally.print(output);
        }
    });
    DEFPRINT(AST_Catch, function(self, output){
        output.print("catch");
        output.space();
        output.with_parens(function(){
            self.argname.print(output);
        });
        output.space();
        print_bracketed(self.body, output);
    });
    DEFPRINT(AST_Finally, function(self, output){
        output.print("finally");
        output.space();
        print_bracketed(self.body, output);
    });

    /* -----[ var/const ]----- */
    AST_Definitions.DEFMETHOD("_do_print", function(output, kind){
        output.print(kind);
        output.space();
        this.definitions.forEach(function(def, i){
            if (i) output.comma();
            def.print(output);
        });
        var p = output.parent();
        var in_for = p instanceof AST_For || p instanceof AST_ForIn;
        var avoid_semicolon = in_for && p.init === this;
        if (!avoid_semicolon)
            output.semicolon();
    });
    DEFPRINT(AST_Var, function(self, output){
        self._do_print(output, "var");
    });
    DEFPRINT(AST_Const, function(self, output){
        self._do_print(output, "const");
    });

    function parenthesize_for_noin(node, output, noin) {
        if (!noin) node.print(output);
        else try {
            // need to take some precautions here:
            //    https://github.com/mishoo/UglifyJS2/issues/60
            node.walk(new TreeWalker(function(node){
                if (node instanceof AST_Binary && node.operator == "in")
                    throw output;
            }));
            node.print(output);
        } catch(ex) {
            if (ex !== output) throw ex;
            node.print(output, true);
        }
    };

    DEFPRINT(AST_VarDef, function(self, output){
        self.name.print(output);
        if (self.value) {
            output.space();
            output.print("=");
            output.space();
            var p = output.parent(1);
            var noin = p instanceof AST_For || p instanceof AST_ForIn;
            parenthesize_for_noin(self.value, output, noin);
        }
    });

    /* -----[ other expressions ]----- */
    DEFPRINT(AST_Call, function(self, output){
        self.expression.print(output);
        if (self instanceof AST_New && no_constructor_parens(self, output))
            return;
        output.with_parens(function(){
            self.args.forEach(function(expr, i){
                if (i) output.comma();
                expr.print(output);
            });
        });
    });
    DEFPRINT(AST_New, function(self, output){
        output.print("new");
        output.space();
        AST_Call.prototype._codegen(self, output);
    });

    AST_Seq.DEFMETHOD("_do_print", function(output){
        this.car.print(output);
        if (this.cdr) {
            output.comma();
            if (output.should_break()) {
                output.newline();
                output.indent();
            }
            this.cdr.print(output);
        }
    });
    DEFPRINT(AST_Seq, function(self, output){
        self._do_print(output);
        // var p = output.parent();
        // if (p instanceof AST_Statement) {
        //     output.with_indent(output.next_indent(), function(){
        //         self._do_print(output);
        //     });
        // } else {
        //     self._do_print(output);
        // }
    });
    DEFPRINT(AST_Dot, function(self, output){
        var expr = self.expression;
        expr.print(output);
        if (expr instanceof AST_Number && expr.getValue() >= 0) {
            if (!/[xa-f.]/i.test(output.last())) {
                output.print(".");
            }
        }
        output.print(".");
        // the name after dot would be mapped about here.
        output.add_mapping(self.end);
        output.print_name(self.property);
    });
    DEFPRINT(AST_Sub, function(self, output){
        self.expression.print(output);
        output.print("[");
        self.property.print(output);
        output.print("]");
    });
    DEFPRINT(AST_UnaryPrefix, function(self, output){
        var op = self.operator;
        output.print(op);
        if (/^[a-z]/i.test(op)
            || (/[+-]$/.test(op)
                && self.expression instanceof AST_UnaryPrefix
                && /^[+-]/.test(self.expression.operator))) {
            output.space();
        }
        self.expression.print(output);
    });
    DEFPRINT(AST_UnaryPostfix, function(self, output){
        self.expression.print(output);
        output.print(self.operator);
    });
    DEFPRINT(AST_Binary, function(self, output){
        self.left.print(output);
        output.space();
        output.print(self.operator);
        if (self.operator == "<"
            && self.right instanceof AST_UnaryPrefix
            && self.right.operator == "!"
            && self.right.expression instanceof AST_UnaryPrefix
            && self.right.expression.operator == "--") {
            // space is mandatory to avoid outputting <!--
            // http://javascript.spec.whatwg.org/#comment-syntax
            output.print(" ");
        } else {
            // the space is optional depending on "beautify"
            output.space();
        }
        self.right.print(output);
    });
    DEFPRINT(AST_Conditional, function(self, output){
        self.condition.print(output);
        output.space();
        output.print("?");
        output.space();
        self.consequent.print(output);
        output.space();
        output.colon();
        self.alternative.print(output);
    });

    /* -----[ literals ]----- */
    DEFPRINT(AST_Array, function(self, output){
        output.with_square(function(){
            var a = self.elements, len = a.length;
            if (len > 0) output.space();
            a.forEach(function(exp, i){
                if (i) output.comma();
                exp.print(output);
                // If the final element is a hole, we need to make sure it
                // doesn't look like a trailing comma, by inserting an actual
                // trailing comma.
                if (i === len - 1 && exp instanceof AST_Hole)
                  output.comma();
            });
            if (len > 0) output.space();
        });
    });
    DEFPRINT(AST_Object, function(self, output){
        if (self.properties.length > 0) output.with_block(function(){
            self.properties.forEach(function(prop, i){
                if (i) {
                    output.print(",");
                    output.newline();
                }
                output.indent();
                prop.print(output);
            });
            output.newline();
        });
        else output.print("{}");
    });
    DEFPRINT(AST_ObjectKeyVal, function(self, output){
        var key = self.key;
        if (output.option("quote_keys")) {
            output.print_string(key + "");
        } else if ((typeof key == "number"
                    || !output.option("beautify")
                    && +key + "" == key)
                   && parseFloat(key) >= 0) {
            output.print(make_num(key));
        } else if (RESERVED_WORDS(key) ? output.option("screw_ie8") : is_identifier_string(key)) {
            output.print_name(key);
        } else {
            output.print_string(key);
        }
        output.colon();
        self.value.print(output);
    });
    DEFPRINT(AST_ObjectSetter, function(self, output){
        output.print("set");
        output.space();
        self.key.print(output);
        self.value._do_print(output, true);
    });
    DEFPRINT(AST_ObjectGetter, function(self, output){
        output.print("get");
        output.space();
        self.key.print(output);
        self.value._do_print(output, true);
    });
    DEFPRINT(AST_Symbol, function(self, output){
        var def = self.definition();
        output.print_name(def ? def.mangled_name || def.name : self.name);
    });
    DEFPRINT(AST_Undefined, function(self, output){
        output.print("void 0");
    });
    DEFPRINT(AST_Hole, noop);
    DEFPRINT(AST_Infinity, function(self, output){
        output.print("1/0");
    });
    DEFPRINT(AST_NaN, function(self, output){
        output.print("0/0");
    });
    DEFPRINT(AST_This, function(self, output){
        output.print("this");
    });
    DEFPRINT(AST_Constant, function(self, output){
        output.print(self.getValue());
    });
    DEFPRINT(AST_String, function(self, output){
        output.print_string(self.getValue());
    });
    DEFPRINT(AST_Number, function(self, output){
        output.print(make_num(self.getValue()));
    });

    function regexp_safe_literal(code) {
        return [
            0x5c   , // \
            0x2f   , // /
            0x2e   , // .
            0x2b   , // +
            0x2a   , // *
            0x3f   , // ?
            0x28   , // (
            0x29   , // )
            0x5b   , // [
            0x5d   , // ]
            0x7b   , // {
            0x7d   , // }
            0x24   , // $
            0x5e   , // ^
            0x3a   , // :
            0x7c   , // |
            0x21   , // !
            0x0a   , // \n
            0x0d   , // \r
            0x00   , // \0
            0xfeff , // Unicode BOM
            0x2028 , // unicode "line separator"
            0x2029 , // unicode "paragraph separator"
        ].indexOf(code) < 0;
    };

    DEFPRINT(AST_RegExp, function(self, output){
        var str = self.getValue().toString();
        if (output.option("ascii_only")) {
            str = output.to_ascii(str);
        } else if (output.option("unescape_regexps")) {
            str = str.split("\\\\").map(function(str){
                return str.replace(/\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}/g, function(s){
                    var code = parseInt(s.substr(2), 16);
                    return regexp_safe_literal(code) ? String.fromCharCode(code) : s;
                });
            }).join("\\\\");
        }
        output.print(str);
        var p = output.parent();
        if (p instanceof AST_Binary && /^in/.test(p.operator) && p.left === self)
            output.print(" ");
    });

    function force_statement(stat, output) {
        if (output.option("bracketize")) {
            if (!stat || stat instanceof AST_EmptyStatement)
                output.print("{}");
            else if (stat instanceof AST_BlockStatement)
                stat.print(output);
            else output.with_block(function(){
                output.indent();
                stat.print(output);
                output.newline();
            });
        } else {
            if (!stat || stat instanceof AST_EmptyStatement)
                output.force_semicolon();
            else
                stat.print(output);
        }
    };

    // return true if the node at the top of the stack (that means the
    // innermost node in the current output) is lexically the first in
    // a statement.
    function first_in_statement(output) {
        var a = output.stack(), i = a.length, node = a[--i], p = a[--i];
        while (i > 0) {
            if (p instanceof AST_Statement && p.body === node)
                return true;
            if ((p instanceof AST_Seq           && p.car === node        ) ||
                (p instanceof AST_Call          && p.expression === node && !(p instanceof AST_New) ) ||
                (p instanceof AST_Dot           && p.expression === node ) ||
                (p instanceof AST_Sub           && p.expression === node ) ||
                (p instanceof AST_Conditional   && p.condition === node  ) ||
                (p instanceof AST_Binary        && p.left === node       ) ||
                (p instanceof AST_UnaryPostfix  && p.expression === node ))
            {
                node = p;
                p = a[--i];
            } else {
                return false;
            }
        }
    };

    // self should be AST_New.  decide if we want to show parens or not.
    function no_constructor_parens(self, output) {
        return self.args.length == 0 && !output.option("beautify");
    };

    function best_of(a) {
        var best = a[0], len = best.length;
        for (var i = 1; i < a.length; ++i) {
            if (a[i].length < len) {
                best = a[i];
                len = best.length;
            }
        }
        return best;
    };

    function make_num(num) {
        var str = num.toString(10), a = [ str.replace(/^0\./, ".").replace('e+', 'e') ], m;
        if (Math.floor(num) === num) {
            if (num >= 0) {
                a.push("0x" + num.toString(16).toLowerCase(), // probably pointless
                       "0" + num.toString(8)); // same.
            } else {
                a.push("-0x" + (-num).toString(16).toLowerCase(), // probably pointless
                       "-0" + (-num).toString(8)); // same.
            }
            if ((m = /^(.*?)(0+)$/.exec(num))) {
                a.push(m[1] + "e" + m[2].length);
            }
        } else if ((m = /^0?\.(0+)(.*)$/.exec(num))) {
            a.push(m[2] + "e-" + (m[1].length + m[2].length),
                   str.substr(str.indexOf(".")));
        }
        return best_of(a);
    };

    function make_block(stmt, output) {
        if (stmt instanceof AST_BlockStatement) {
            stmt.print(output);
            return;
        }
        output.with_block(function(){
            output.indent();
            stmt.print(output);
            output.newline();
        });
    };

    /* -----[ source map generators ]----- */

    function DEFMAP(nodetype, generator) {
        nodetype.DEFMETHOD("add_source_map", function(stream){
            generator(this, stream);
        });
    };

    // We could easily add info for ALL nodes, but it seems to me that
    // would be quite wasteful, hence this noop in the base class.
    DEFMAP(AST_Node, noop);

    function basic_sourcemap_gen(self, output) {
        output.add_mapping(self.start);
    };

    // XXX: I'm not exactly sure if we need it for all of these nodes,
    // or if we should add even more.

    DEFMAP(AST_Directive, basic_sourcemap_gen);
    DEFMAP(AST_Debugger, basic_sourcemap_gen);
    DEFMAP(AST_Symbol, basic_sourcemap_gen);
    DEFMAP(AST_Jump, basic_sourcemap_gen);
    DEFMAP(AST_StatementWithBody, basic_sourcemap_gen);
    DEFMAP(AST_LabeledStatement, noop); // since the label symbol will mark it
    DEFMAP(AST_Lambda, basic_sourcemap_gen);
    DEFMAP(AST_Switch, basic_sourcemap_gen);
    DEFMAP(AST_SwitchBranch, basic_sourcemap_gen);
    DEFMAP(AST_BlockStatement, basic_sourcemap_gen);
    DEFMAP(AST_Toplevel, noop);
    DEFMAP(AST_New, basic_sourcemap_gen);
    DEFMAP(AST_Try, basic_sourcemap_gen);
    DEFMAP(AST_Catch, basic_sourcemap_gen);
    DEFMAP(AST_Finally, basic_sourcemap_gen);
    DEFMAP(AST_Definitions, basic_sourcemap_gen);
    DEFMAP(AST_Constant, basic_sourcemap_gen);
    DEFMAP(AST_ObjectProperty, function(self, output){
        output.add_mapping(self.start, self.key);
    });

})();

/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS2

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

function Compressor(options, false_by_default) {
    if (!(this instanceof Compressor))
        return new Compressor(options, false_by_default);
    TreeTransformer.call(this, this.before, this.after);
    this.options = defaults(options, {
        sequences     : !false_by_default,
        properties    : !false_by_default,
        dead_code     : !false_by_default,
        drop_debugger : !false_by_default,
        unsafe        : false,
        unsafe_comps  : false,
        conditionals  : !false_by_default,
        comparisons   : !false_by_default,
        evaluate      : !false_by_default,
        booleans      : !false_by_default,
        loops         : !false_by_default,
        unused        : !false_by_default,
        hoist_funs    : !false_by_default,
        keep_fargs    : false,
        hoist_vars    : false,
        if_return     : !false_by_default,
        join_vars     : !false_by_default,
        cascade       : !false_by_default,
        side_effects  : !false_by_default,
        pure_getters  : false,
        pure_funcs    : null,
        negate_iife   : !false_by_default,
        screw_ie8     : false,
        drop_console  : false,
        angular       : false,

        warnings      : true,
        global_defs   : {}
    }, true);
};

Compressor.prototype = new TreeTransformer;
merge(Compressor.prototype, {
    option: function(key) { return this.options[key] },
    warn: function() {
        if (this.options.warnings)
            AST_Node.warn.apply(AST_Node, arguments);
    },
    before: function(node, descend, in_list) {
        if (node._squeezed) return node;
        var was_scope = false;
        if (node instanceof AST_Scope) {
            node = node.hoist_declarations(this);
            was_scope = true;
        }
        descend(node, this);
        node = node.optimize(this);
        if (was_scope && node instanceof AST_Scope) {
            node.drop_unused(this);
            descend(node, this);
        }
        node._squeezed = true;
        return node;
    }
});

(function(){

    function OPT(node, optimizer) {
        node.DEFMETHOD("optimize", function(compressor){
            var self = this;
            if (self._optimized) return self;
            var opt = optimizer(self, compressor);
            opt._optimized = true;
            if (opt === self) return opt;
            return opt.transform(compressor);
        });
    };

    OPT(AST_Node, function(self, compressor){
        return self;
    });

    AST_Node.DEFMETHOD("equivalent_to", function(node){
        // XXX: this is a rather expensive way to test two node's equivalence:
        return this.print_to_string() == node.print_to_string();
    });

    function make_node(ctor, orig, props) {
        if (!props) props = {};
        if (orig) {
            if (!props.start) props.start = orig.start;
            if (!props.end) props.end = orig.end;
        }
        return new ctor(props);
    };

    function make_node_from_constant(compressor, val, orig) {
        // XXX: WIP.
        // if (val instanceof AST_Node) return val.transform(new TreeTransformer(null, function(node){
        //     if (node instanceof AST_SymbolRef) {
        //         var scope = compressor.find_parent(AST_Scope);
        //         var def = scope.find_variable(node);
        //         node.thedef = def;
        //         return node;
        //     }
        // })).transform(compressor);

        if (val instanceof AST_Node) return val.transform(compressor);
        switch (typeof val) {
          case "string":
            return make_node(AST_String, orig, {
                value: val
            }).optimize(compressor);
          case "number":
            return make_node(isNaN(val) ? AST_NaN : AST_Number, orig, {
                value: val
            }).optimize(compressor);
          case "boolean":
            return make_node(val ? AST_True : AST_False, orig).optimize(compressor);
          case "undefined":
            return make_node(AST_Undefined, orig).optimize(compressor);
          default:
            if (val === null) {
                return make_node(AST_Null, orig).optimize(compressor);
            }
            if (val instanceof RegExp) {
                return make_node(AST_RegExp, orig).optimize(compressor);
            }
            throw new Error(string_template("Can't handle constant of type: {type}", {
                type: typeof val
            }));
        }
    };

    function as_statement_array(thing) {
        if (thing === null) return [];
        if (thing instanceof AST_BlockStatement) return thing.body;
        if (thing instanceof AST_EmptyStatement) return [];
        if (thing instanceof AST_Statement) return [ thing ];
        throw new Error("Can't convert thing to statement array");
    };

    function is_empty(thing) {
        if (thing === null) return true;
        if (thing instanceof AST_EmptyStatement) return true;
        if (thing instanceof AST_BlockStatement) return thing.body.length == 0;
        return false;
    };

    function loop_body(x) {
        if (x instanceof AST_Switch) return x;
        if (x instanceof AST_For || x instanceof AST_ForIn || x instanceof AST_DWLoop) {
            return (x.body instanceof AST_BlockStatement ? x.body : x);
        }
        return x;
    };

    function tighten_body(statements, compressor) {
        var CHANGED;
        do {
            CHANGED = false;
            if (compressor.option("angular")) {
                statements = process_for_angular(statements);
            }
            statements = eliminate_spurious_blocks(statements);
            if (compressor.option("dead_code")) {
                statements = eliminate_dead_code(statements, compressor);
            }
            if (compressor.option("if_return")) {
                statements = handle_if_return(statements, compressor);
            }
            if (compressor.option("sequences")) {
                statements = sequencesize(statements, compressor);
            }
            if (compressor.option("join_vars")) {
                statements = join_consecutive_vars(statements, compressor);
            }
        } while (CHANGED);

        if (compressor.option("negate_iife")) {
            negate_iifes(statements, compressor);
        }

        return statements;

        function process_for_angular(statements) {
            function make_injector(func, name) {
                return make_node(AST_SimpleStatement, func, {
                    body: make_node(AST_Assign, func, {
                        operator: "=",
                        left: make_node(AST_Dot, name, {
                            expression: make_node(AST_SymbolRef, name, name),
                            property: "$inject"
                        }),
                        right: make_node(AST_Array, func, {
                            elements: func.argnames.map(function(sym){
                                return make_node(AST_String, sym, { value: sym.name });
                            })
                        })
                    })
                });
            }
            return statements.reduce(function(a, stat){
                a.push(stat);
                var token = stat.start;
                var comments = token.comments_before;
                if (comments && comments.length > 0) {
                    var last = comments.pop();
                    if (/@ngInject/.test(last.value)) {
                        // case 1: defun
                        if (stat instanceof AST_Defun) {
                            a.push(make_injector(stat, stat.name));
                        }
                        else if (stat instanceof AST_Definitions) {
                            stat.definitions.forEach(function(def){
                                if (def.value && def.value instanceof AST_Lambda) {
                                    a.push(make_injector(def.value, def.name));
                                }
                            });
                        }
                        else {
                            compressor.warn("Unknown statement marked with @ngInject [{file}:{line},{col}]", token);
                        }
                    }
                }
                return a;
            }, []);
        }

        function eliminate_spurious_blocks(statements) {
            var seen_dirs = [];
            return statements.reduce(function(a, stat){
                if (stat instanceof AST_BlockStatement) {
                    CHANGED = true;
                    a.push.apply(a, eliminate_spurious_blocks(stat.body));
                } else if (stat instanceof AST_EmptyStatement) {
                    CHANGED = true;
                } else if (stat instanceof AST_Directive) {
                    if (seen_dirs.indexOf(stat.value) < 0) {
                        a.push(stat);
                        seen_dirs.push(stat.value);
                    } else {
                        CHANGED = true;
                    }
                } else {
                    a.push(stat);
                }
                return a;
            }, []);
        };

        function handle_if_return(statements, compressor) {
            var self = compressor.self();
            var in_lambda = self instanceof AST_Lambda;
            var ret = [];
            loop: for (var i = statements.length; --i >= 0;) {
                var stat = statements[i];
                switch (true) {
                  case (in_lambda && stat instanceof AST_Return && !stat.value && ret.length == 0):
                    CHANGED = true;
                    // note, ret.length is probably always zero
                    // because we drop unreachable code before this
                    // step.  nevertheless, it's good to check.
                    continue loop;
                  case stat instanceof AST_If:
                    if (stat.body instanceof AST_Return) {
                        //---
                        // pretty silly case, but:
                        // if (foo()) return; return; ==> foo(); return;
                        if (((in_lambda && ret.length == 0)
                             || (ret[0] instanceof AST_Return && !ret[0].value))
                            && !stat.body.value && !stat.alternative) {
                            CHANGED = true;
                            var cond = make_node(AST_SimpleStatement, stat.condition, {
                                body: stat.condition
                            });
                            ret.unshift(cond);
                            continue loop;
                        }
                        //---
                        // if (foo()) return x; return y; ==> return foo() ? x : y;
                        if (ret[0] instanceof AST_Return && stat.body.value && ret[0].value && !stat.alternative) {
                            CHANGED = true;
                            stat = stat.clone();
                            stat.alternative = ret[0];
                            ret[0] = stat.transform(compressor);
                            continue loop;
                        }
                        //---
                        // if (foo()) return x; [ return ; ] ==> return foo() ? x : undefined;
                        if ((ret.length == 0 || ret[0] instanceof AST_Return) && stat.body.value && !stat.alternative && in_lambda) {
                            CHANGED = true;
                            stat = stat.clone();
                            stat.alternative = ret[0] || make_node(AST_Return, stat, {
                                value: make_node(AST_Undefined, stat)
                            });
                            ret[0] = stat.transform(compressor);
                            continue loop;
                        }
                        //---
                        // if (foo()) return; [ else x... ]; y... ==> if (!foo()) { x...; y... }
                        if (!stat.body.value && in_lambda) {
                            CHANGED = true;
                            stat = stat.clone();
                            stat.condition = stat.condition.negate(compressor);
                            stat.body = make_node(AST_BlockStatement, stat, {
                                body: as_statement_array(stat.alternative).concat(ret)
                            });
                            stat.alternative = null;
                            ret = [ stat.transform(compressor) ];
                            continue loop;
                        }
                        //---
                        if (ret.length == 1 && in_lambda && ret[0] instanceof AST_SimpleStatement
                            && (!stat.alternative || stat.alternative instanceof AST_SimpleStatement)) {
                            CHANGED = true;
                            ret.push(make_node(AST_Return, ret[0], {
                                value: make_node(AST_Undefined, ret[0])
                            }).transform(compressor));
                            ret = as_statement_array(stat.alternative).concat(ret);
                            ret.unshift(stat);
                            continue loop;
                        }
                    }

                    var ab = aborts(stat.body);
                    var lct = ab instanceof AST_LoopControl ? compressor.loopcontrol_target(ab.label) : null;
                    if (ab && ((ab instanceof AST_Return && !ab.value && in_lambda)
                               || (ab instanceof AST_Continue && self === loop_body(lct))
                               || (ab instanceof AST_Break && lct instanceof AST_BlockStatement && self === lct))) {
                        if (ab.label) {
                            remove(ab.label.thedef.references, ab);
                        }
                        CHANGED = true;
                        var body = as_statement_array(stat.body).slice(0, -1);
                        stat = stat.clone();
                        stat.condition = stat.condition.negate(compressor);
                        stat.body = make_node(AST_BlockStatement, stat, {
                            body: as_statement_array(stat.alternative).concat(ret)
                        });
                        stat.alternative = make_node(AST_BlockStatement, stat, {
                            body: body
                        });
                        ret = [ stat.transform(compressor) ];
                        continue loop;
                    }

                    var ab = aborts(stat.alternative);
                    var lct = ab instanceof AST_LoopControl ? compressor.loopcontrol_target(ab.label) : null;
                    if (ab && ((ab instanceof AST_Return && !ab.value && in_lambda)
                               || (ab instanceof AST_Continue && self === loop_body(lct))
                               || (ab instanceof AST_Break && lct instanceof AST_BlockStatement && self === lct))) {
                        if (ab.label) {
                            remove(ab.label.thedef.references, ab);
                        }
                        CHANGED = true;
                        stat = stat.clone();
                        stat.body = make_node(AST_BlockStatement, stat.body, {
                            body: as_statement_array(stat.body).concat(ret)
                        });
                        stat.alternative = make_node(AST_BlockStatement, stat.alternative, {
                            body: as_statement_array(stat.alternative).slice(0, -1)
                        });
                        ret = [ stat.transform(compressor) ];
                        continue loop;
                    }

                    ret.unshift(stat);
                    break;
                  default:
                    ret.unshift(stat);
                    break;
                }
            }
            return ret;
        };

        function eliminate_dead_code(statements, compressor) {
            var has_quit = false;
            var orig = statements.length;
            var self = compressor.self();
            statements = statements.reduce(function(a, stat){
                if (has_quit) {
                    extract_declarations_from_unreachable_code(compressor, stat, a);
                } else {
                    if (stat instanceof AST_LoopControl) {
                        var lct = compressor.loopcontrol_target(stat.label);
                        if ((stat instanceof AST_Break
                             && lct instanceof AST_BlockStatement
                             && loop_body(lct) === self) || (stat instanceof AST_Continue
                                                             && loop_body(lct) === self)) {
                            if (stat.label) {
                                remove(stat.label.thedef.references, stat);
                            }
                        } else {
                            a.push(stat);
                        }
                    } else {
                        a.push(stat);
                    }
                    if (aborts(stat)) has_quit = true;
                }
                return a;
            }, []);
            CHANGED = statements.length != orig;
            return statements;
        };

        function sequencesize(statements, compressor) {
            if (statements.length < 2) return statements;
            var seq = [], ret = [];
            function push_seq() {
                seq = AST_Seq.from_array(seq);
                if (seq) ret.push(make_node(AST_SimpleStatement, seq, {
                    body: seq
                }));
                seq = [];
            };
            statements.forEach(function(stat){
                if (stat instanceof AST_SimpleStatement) seq.push(stat.body);
                else push_seq(), ret.push(stat);
            });
            push_seq();
            ret = sequencesize_2(ret, compressor);
            CHANGED = ret.length != statements.length;
            return ret;
        };

        function sequencesize_2(statements, compressor) {
            function cons_seq(right) {
                ret.pop();
                var left = prev.body;
                if (left instanceof AST_Seq) {
                    left.add(right);
                } else {
                    left = AST_Seq.cons(left, right);
                }
                return left.transform(compressor);
            };
            var ret = [], prev = null;
            statements.forEach(function(stat){
                if (prev) {
                    if (stat instanceof AST_For) {
                        var opera = {};
                        try {
                            prev.body.walk(new TreeWalker(function(node){
                                if (node instanceof AST_Binary && node.operator == "in")
                                    throw opera;
                            }));
                            if (stat.init && !(stat.init instanceof AST_Definitions)) {
                                stat.init = cons_seq(stat.init);
                            }
                            else if (!stat.init) {
                                stat.init = prev.body;
                                ret.pop();
                            }
                        } catch(ex) {
                            if (ex !== opera) throw ex;
                        }
                    }
                    else if (stat instanceof AST_If) {
                        stat.condition = cons_seq(stat.condition);
                    }
                    else if (stat instanceof AST_With) {
                        stat.expression = cons_seq(stat.expression);
                    }
                    else if (stat instanceof AST_Exit && stat.value) {
                        stat.value = cons_seq(stat.value);
                    }
                    else if (stat instanceof AST_Exit) {
                        stat.value = cons_seq(make_node(AST_Undefined, stat));
                    }
                    else if (stat instanceof AST_Switch) {
                        stat.expression = cons_seq(stat.expression);
                    }
                }
                ret.push(stat);
                prev = stat instanceof AST_SimpleStatement ? stat : null;
            });
            return ret;
        };

        function join_consecutive_vars(statements, compressor) {
            var prev = null;
            return statements.reduce(function(a, stat){
                if (stat instanceof AST_Definitions && prev && prev.TYPE == stat.TYPE) {
                    prev.definitions = prev.definitions.concat(stat.definitions);
                    CHANGED = true;
                }
                else if (stat instanceof AST_For
                         && prev instanceof AST_Definitions
                         && (!stat.init || stat.init.TYPE == prev.TYPE)) {
                    CHANGED = true;
                    a.pop();
                    if (stat.init) {
                        stat.init.definitions = prev.definitions.concat(stat.init.definitions);
                    } else {
                        stat.init = prev;
                    }
                    a.push(stat);
                    prev = stat;
                }
                else {
                    prev = stat;
                    a.push(stat);
                }
                return a;
            }, []);
        };

        function negate_iifes(statements, compressor) {
            statements.forEach(function(stat){
                if (stat instanceof AST_SimpleStatement) {
                    stat.body = (function transform(thing) {
                        return thing.transform(new TreeTransformer(function(node){
                            if (node instanceof AST_Call && node.expression instanceof AST_Function) {
                                return make_node(AST_UnaryPrefix, node, {
                                    operator: "!",
                                    expression: node
                                });
                            }
                            else if (node instanceof AST_Call) {
                                node.expression = transform(node.expression);
                            }
                            else if (node instanceof AST_Seq) {
                                node.car = transform(node.car);
                            }
                            else if (node instanceof AST_Conditional) {
                                var expr = transform(node.condition);
                                if (expr !== node.condition) {
                                    // it has been negated, reverse
                                    node.condition = expr;
                                    var tmp = node.consequent;
                                    node.consequent = node.alternative;
                                    node.alternative = tmp;
                                }
                            }
                            return node;
                        }));
                    })(stat.body);
                }
            });
        };

    };

    function extract_declarations_from_unreachable_code(compressor, stat, target) {
        compressor.warn("Dropping unreachable code [{file}:{line},{col}]", stat.start);
        stat.walk(new TreeWalker(function(node){
            if (node instanceof AST_Definitions) {
                compressor.warn("Declarations in unreachable code! [{file}:{line},{col}]", node.start);
                node.remove_initializers();
                target.push(node);
                return true;
            }
            if (node instanceof AST_Defun) {
                target.push(node);
                return true;
            }
            if (node instanceof AST_Scope) {
                return true;
            }
        }));
    };

    /* -----[ boolean/negation helpers ]----- */

    // methods to determine whether an expression has a boolean result type
    (function (def){
        var unary_bool = [ "!", "delete" ];
        var binary_bool = [ "in", "instanceof", "==", "!=", "===", "!==", "<", "<=", ">=", ">" ];
        def(AST_Node, function(){ return false });
        def(AST_UnaryPrefix, function(){
            return member(this.operator, unary_bool);
        });
        def(AST_Binary, function(){
            return member(this.operator, binary_bool) ||
                ( (this.operator == "&&" || this.operator == "||") &&
                  this.left.is_boolean() && this.right.is_boolean() );
        });
        def(AST_Conditional, function(){
            return this.consequent.is_boolean() && this.alternative.is_boolean();
        });
        def(AST_Assign, function(){
            return this.operator == "=" && this.right.is_boolean();
        });
        def(AST_Seq, function(){
            return this.cdr.is_boolean();
        });
        def(AST_True, function(){ return true });
        def(AST_False, function(){ return true });
    })(function(node, func){
        node.DEFMETHOD("is_boolean", func);
    });

    // methods to determine if an expression has a string result type
    (function (def){
        def(AST_Node, function(){ return false });
        def(AST_String, function(){ return true });
        def(AST_UnaryPrefix, function(){
            return this.operator == "typeof";
        });
        def(AST_Binary, function(compressor){
            return this.operator == "+" &&
                (this.left.is_string(compressor) || this.right.is_string(compressor));
        });
        def(AST_Assign, function(compressor){
            return (this.operator == "=" || this.operator == "+=") && this.right.is_string(compressor);
        });
        def(AST_Seq, function(compressor){
            return this.cdr.is_string(compressor);
        });
        def(AST_Conditional, function(compressor){
            return this.consequent.is_string(compressor) && this.alternative.is_string(compressor);
        });
        def(AST_Call, function(compressor){
            return compressor.option("unsafe")
                && this.expression instanceof AST_SymbolRef
                && this.expression.name == "String"
                && this.expression.undeclared();
        });
    })(function(node, func){
        node.DEFMETHOD("is_string", func);
    });

    function best_of(ast1, ast2) {
        return ast1.print_to_string().length >
            ast2.print_to_string().length
            ? ast2 : ast1;
    };

    // methods to evaluate a constant expression
    (function (def){
        // The evaluate method returns an array with one or two
        // elements.  If the node has been successfully reduced to a
        // constant, then the second element tells us the value;
        // otherwise the second element is missing.  The first element
        // of the array is always an AST_Node descendant; if
        // evaluation was successful it's a node that represents the
        // constant; otherwise it's the original or a replacement node.
        AST_Node.DEFMETHOD("evaluate", function(compressor){
            if (!compressor.option("evaluate")) return [ this ];
            try {
                var val = this._eval(compressor);
                return [ best_of(make_node_from_constant(compressor, val, this), this), val ];
            } catch(ex) {
                if (ex !== def) throw ex;
                return [ this ];
            }
        });
        def(AST_Statement, function(){
            throw new Error(string_template("Cannot evaluate a statement [{file}:{line},{col}]", this.start));
        });
        def(AST_Function, function(){
            // XXX: AST_Function inherits from AST_Scope, which itself
            // inherits from AST_Statement; however, an AST_Function
            // isn't really a statement.  This could byte in other
            // places too. :-( Wish JS had multiple inheritance.
            throw def;
        });
        function ev(node, compressor) {
            if (!compressor) throw new Error("Compressor must be passed");

            return node._eval(compressor);
        };
        def(AST_Node, function(){
            throw def;          // not constant
        });
        def(AST_Constant, function(){
            return this.getValue();
        });
        def(AST_UnaryPrefix, function(compressor){
            var e = this.expression;
            switch (this.operator) {
              case "!": return !ev(e, compressor);
              case "typeof":
                // Function would be evaluated to an array and so typeof would
                // incorrectly return 'object'. Hence making is a special case.
                if (e instanceof AST_Function) return typeof function(){};

                e = ev(e, compressor);

                // typeof <RegExp> returns "object" or "function" on different platforms
                // so cannot evaluate reliably
                if (e instanceof RegExp) throw def;

                return typeof e;
              case "void": return void ev(e, compressor);
              case "~": return ~ev(e, compressor);
              case "-":
                e = ev(e, compressor);
                if (e === 0) throw def;
                return -e;
              case "+": return +ev(e, compressor);
            }
            throw def;
        });
        def(AST_Binary, function(c){
            var left = this.left, right = this.right;
            switch (this.operator) {
              case "&&"         : return ev(left, c) &&         ev(right, c);
              case "||"         : return ev(left, c) ||         ev(right, c);
              case "|"          : return ev(left, c) |          ev(right, c);
              case "&"          : return ev(left, c) &          ev(right, c);
              case "^"          : return ev(left, c) ^          ev(right, c);
              case "+"          : return ev(left, c) +          ev(right, c);
              case "*"          : return ev(left, c) *          ev(right, c);
              case "/"          : return ev(left, c) /          ev(right, c);
              case "%"          : return ev(left, c) %          ev(right, c);
              case "-"          : return ev(left, c) -          ev(right, c);
              case "<<"         : return ev(left, c) <<         ev(right, c);
              case ">>"         : return ev(left, c) >>         ev(right, c);
              case ">>>"        : return ev(left, c) >>>        ev(right, c);
              case "=="         : return ev(left, c) ==         ev(right, c);
              case "==="        : return ev(left, c) ===        ev(right, c);
              case "!="         : return ev(left, c) !=         ev(right, c);
              case "!=="        : return ev(left, c) !==        ev(right, c);
              case "<"          : return ev(left, c) <          ev(right, c);
              case "<="         : return ev(left, c) <=         ev(right, c);
              case ">"          : return ev(left, c) >          ev(right, c);
              case ">="         : return ev(left, c) >=         ev(right, c);
              case "in"         : return ev(left, c) in         ev(right, c);
              case "instanceof" : return ev(left, c) instanceof ev(right, c);
            }
            throw def;
        });
        def(AST_Conditional, function(compressor){
            return ev(this.condition, compressor)
                ? ev(this.consequent, compressor)
                : ev(this.alternative, compressor);
        });
        def(AST_SymbolRef, function(compressor){
            var d = this.definition();
            if (d && d.constant && d.init) return ev(d.init, compressor);
            throw def;
        });
        def(AST_Dot, function(compressor){
            if (compressor.option("unsafe") && this.property == "length") {
                var str = ev(this.expression, compressor);
                if (typeof str == "string")
                    return str.length;
            }
            throw def;
        });
    })(function(node, func){
        node.DEFMETHOD("_eval", func);
    });

    // method to negate an expression
    (function(def){
        function basic_negation(exp) {
            return make_node(AST_UnaryPrefix, exp, {
                operator: "!",
                expression: exp
            });
        };
        def(AST_Node, function(){
            return basic_negation(this);
        });
        def(AST_Statement, function(){
            throw new Error("Cannot negate a statement");
        });
        def(AST_Function, function(){
            return basic_negation(this);
        });
        def(AST_UnaryPrefix, function(){
            if (this.operator == "!")
                return this.expression;
            return basic_negation(this);
        });
        def(AST_Seq, function(compressor){
            var self = this.clone();
            self.cdr = self.cdr.negate(compressor);
            return self;
        });
        def(AST_Conditional, function(compressor){
            var self = this.clone();
            self.consequent = self.consequent.negate(compressor);
            self.alternative = self.alternative.negate(compressor);
            return best_of(basic_negation(this), self);
        });
        def(AST_Binary, function(compressor){
            var self = this.clone(), op = this.operator;
            if (compressor.option("unsafe_comps")) {
                switch (op) {
                  case "<=" : self.operator = ">"  ; return self;
                  case "<"  : self.operator = ">=" ; return self;
                  case ">=" : self.operator = "<"  ; return self;
                  case ">"  : self.operator = "<=" ; return self;
                }
            }
            switch (op) {
              case "==" : self.operator = "!="; return self;
              case "!=" : self.operator = "=="; return self;
              case "===": self.operator = "!=="; return self;
              case "!==": self.operator = "==="; return self;
              case "&&":
                self.operator = "||";
                self.left = self.left.negate(compressor);
                self.right = self.right.negate(compressor);
                return best_of(basic_negation(this), self);
              case "||":
                self.operator = "&&";
                self.left = self.left.negate(compressor);
                self.right = self.right.negate(compressor);
                return best_of(basic_negation(this), self);
            }
            return basic_negation(this);
        });
    })(function(node, func){
        node.DEFMETHOD("negate", function(compressor){
            return func.call(this, compressor);
        });
    });

    // determine if expression has side effects
    (function(def){
        def(AST_Node, function(compressor){ return true });

        def(AST_EmptyStatement, function(compressor){ return false });
        def(AST_Constant, function(compressor){ return false });
        def(AST_This, function(compressor){ return false });

        def(AST_Call, function(compressor){
            var pure = compressor.option("pure_funcs");
            if (!pure) return true;
            return pure.indexOf(this.expression.print_to_string()) < 0;
        });

        def(AST_Block, function(compressor){
            for (var i = this.body.length; --i >= 0;) {
                if (this.body[i].has_side_effects(compressor))
                    return true;
            }
            return false;
        });

        def(AST_SimpleStatement, function(compressor){
            return this.body.has_side_effects(compressor);
        });
        def(AST_Defun, function(compressor){ return true });
        def(AST_Function, function(compressor){ return false });
        def(AST_Binary, function(compressor){
            return this.left.has_side_effects(compressor)
                || this.right.has_side_effects(compressor);
        });
        def(AST_Assign, function(compressor){ return true });
        def(AST_Conditional, function(compressor){
            return this.condition.has_side_effects(compressor)
                || this.consequent.has_side_effects(compressor)
                || this.alternative.has_side_effects(compressor);
        });
        def(AST_Unary, function(compressor){
            return this.operator == "delete"
                || this.operator == "++"
                || this.operator == "--"
                || this.expression.has_side_effects(compressor);
        });
        def(AST_SymbolRef, function(compressor){ return false });
        def(AST_Object, function(compressor){
            for (var i = this.properties.length; --i >= 0;)
                if (this.properties[i].has_side_effects(compressor))
                    return true;
            return false;
        });
        def(AST_ObjectProperty, function(compressor){
            return this.value.has_side_effects(compressor);
        });
        def(AST_Array, function(compressor){
            for (var i = this.elements.length; --i >= 0;)
                if (this.elements[i].has_side_effects(compressor))
                    return true;
            return false;
        });
        def(AST_Dot, function(compressor){
            if (!compressor.option("pure_getters")) return true;
            return this.expression.has_side_effects(compressor);
        });
        def(AST_Sub, function(compressor){
            if (!compressor.option("pure_getters")) return true;
            return this.expression.has_side_effects(compressor)
                || this.property.has_side_effects(compressor);
        });
        def(AST_PropAccess, function(compressor){
            return !compressor.option("pure_getters");
        });
        def(AST_Seq, function(compressor){
            return this.car.has_side_effects(compressor)
                || this.cdr.has_side_effects(compressor);
        });
    })(function(node, func){
        node.DEFMETHOD("has_side_effects", func);
    });

    // tell me if a statement aborts
    function aborts(thing) {
        return thing && thing.aborts();
    };
    (function(def){
        def(AST_Statement, function(){ return null });
        def(AST_Jump, function(){ return this });
        function block_aborts(){
            var n = this.body.length;
            return n > 0 && aborts(this.body[n - 1]);
        };
        def(AST_BlockStatement, block_aborts);
        def(AST_SwitchBranch, block_aborts);
        def(AST_If, function(){
            return this.alternative && aborts(this.body) && aborts(this.alternative);
        });
    })(function(node, func){
        node.DEFMETHOD("aborts", func);
    });

    /* -----[ optimizers ]----- */

    OPT(AST_Directive, function(self, compressor){
        if (self.scope.has_directive(self.value) !== self.scope) {
            return make_node(AST_EmptyStatement, self);
        }
        return self;
    });

    OPT(AST_Debugger, function(self, compressor){
        if (compressor.option("drop_debugger"))
            return make_node(AST_EmptyStatement, self);
        return self;
    });

    OPT(AST_LabeledStatement, function(self, compressor){
        if (self.body instanceof AST_Break
            && compressor.loopcontrol_target(self.body.label) === self.body) {
            return make_node(AST_EmptyStatement, self);
        }
        return self.label.references.length == 0 ? self.body : self;
    });

    OPT(AST_Block, function(self, compressor){
        self.body = tighten_body(self.body, compressor);
        return self;
    });

    OPT(AST_BlockStatement, function(self, compressor){
        self.body = tighten_body(self.body, compressor);
        switch (self.body.length) {
          case 1: return self.body[0];
          case 0: return make_node(AST_EmptyStatement, self);
        }
        return self;
    });

    AST_Scope.DEFMETHOD("drop_unused", function(compressor){
        var self = this;
        if (compressor.option("unused")
            && !(self instanceof AST_Toplevel)
            && !self.uses_eval
           ) {
            var in_use = [];
            var initializations = new Dictionary();
            // pass 1: find out which symbols are directly used in
            // this scope (not in nested scopes).
            var scope = this;
            var tw = new TreeWalker(function(node, descend){
                if (node !== self) {
                    if (node instanceof AST_Defun) {
                        initializations.add(node.name.name, node);
                        return true; // don't go in nested scopes
                    }
                    if (node instanceof AST_Definitions && scope === self) {
                        node.definitions.forEach(function(def){
                            if (def.value) {
                                initializations.add(def.name.name, def.value);
                                if (def.value.has_side_effects(compressor)) {
                                    def.value.walk(tw);
                                }
                            }
                        });
                        return true;
                    }
                    if (node instanceof AST_SymbolRef) {
                        push_uniq(in_use, node.definition());
                        return true;
                    }
                    if (node instanceof AST_Scope) {
                        var save_scope = scope;
                        scope = node;
                        descend();
                        scope = save_scope;
                        return true;
                    }
                }
            });
            self.walk(tw);
            // pass 2: for every used symbol we need to walk its
            // initialization code to figure out if it uses other
            // symbols (that may not be in_use).
            for (var i = 0; i < in_use.length; ++i) {
                in_use[i].orig.forEach(function(decl){
                    // undeclared globals will be instanceof AST_SymbolRef
                    var init = initializations.get(decl.name);
                    if (init) init.forEach(function(init){
                        var tw = new TreeWalker(function(node){
                            if (node instanceof AST_SymbolRef) {
                                push_uniq(in_use, node.definition());
                            }
                        });
                        init.walk(tw);
                    });
                });
            }
            // pass 3: we should drop declarations not in_use
            var tt = new TreeTransformer(
                function before(node, descend, in_list) {
                    if (node instanceof AST_Lambda && !(node instanceof AST_Accessor)) {
                        if (!compressor.option("keep_fargs")) {
                            for (var a = node.argnames, i = a.length; --i >= 0;) {
                                var sym = a[i];
                                if (sym.unreferenced()) {
                                    a.pop();
                                    compressor.warn("Dropping unused function argument {name} [{file}:{line},{col}]", {
                                        name : sym.name,
                                        file : sym.start.file,
                                        line : sym.start.line,
                                        col  : sym.start.col
                                    });
                                }
                                else break;
                            }
                        }
                    }
                    if (node instanceof AST_Defun && node !== self) {
                        if (!member(node.name.definition(), in_use)) {
                            compressor.warn("Dropping unused function {name} [{file}:{line},{col}]", {
                                name : node.name.name,
                                file : node.name.start.file,
                                line : node.name.start.line,
                                col  : node.name.start.col
                            });
                            return make_node(AST_EmptyStatement, node);
                        }
                        return node;
                    }
                    if (node instanceof AST_Definitions && !(tt.parent() instanceof AST_ForIn)) {
                        var def = node.definitions.filter(function(def){
                            if (member(def.name.definition(), in_use)) return true;
                            var w = {
                                name : def.name.name,
                                file : def.name.start.file,
                                line : def.name.start.line,
                                col  : def.name.start.col
                            };
                            if (def.value && def.value.has_side_effects(compressor)) {
                                def._unused_side_effects = true;
                                compressor.warn("Side effects in initialization of unused variable {name} [{file}:{line},{col}]", w);
                                return true;
                            }
                            compressor.warn("Dropping unused variable {name} [{file}:{line},{col}]", w);
                            return false;
                        });
                        // place uninitialized names at the start
                        def = mergeSort(def, function(a, b){
                            if (!a.value && b.value) return -1;
                            if (!b.value && a.value) return 1;
                            return 0;
                        });
                        // for unused names whose initialization has
                        // side effects, we can cascade the init. code
                        // into the next one, or next statement.
                        var side_effects = [];
                        for (var i = 0; i < def.length;) {
                            var x = def[i];
                            if (x._unused_side_effects) {
                                side_effects.push(x.value);
                                def.splice(i, 1);
                            } else {
                                if (side_effects.length > 0) {
                                    side_effects.push(x.value);
                                    x.value = AST_Seq.from_array(side_effects);
                                    side_effects = [];
                                }
                                ++i;
                            }
                        }
                        if (side_effects.length > 0) {
                            side_effects = make_node(AST_BlockStatement, node, {
                                body: [ make_node(AST_SimpleStatement, node, {
                                    body: AST_Seq.from_array(side_effects)
                                }) ]
                            });
                        } else {
                            side_effects = null;
                        }
                        if (def.length == 0 && !side_effects) {
                            return make_node(AST_EmptyStatement, node);
                        }
                        if (def.length == 0) {
                            return side_effects;
                        }
                        node.definitions = def;
                        if (side_effects) {
                            side_effects.body.unshift(node);
                            node = side_effects;
                        }
                        return node;
                    }
                    if (node instanceof AST_For) {
                        descend(node, this);

                        if (node.init instanceof AST_BlockStatement) {
                            // certain combination of unused name + side effect leads to:
                            //    https://github.com/mishoo/UglifyJS2/issues/44
                            // that's an invalid AST.
                            // We fix it at this stage by moving the `var` outside the `for`.

                            var body = node.init.body.slice(0, -1);
                            node.init = node.init.body.slice(-1)[0].body;
                            body.push(node);

                            return in_list ? MAP.splice(body) : make_node(AST_BlockStatement, node, {
                                body: body
                            });
                        }
                    }
                    if (node instanceof AST_Scope && node !== self)
                        return node;
                }
            );
            self.transform(tt);
        }
    });

    AST_Scope.DEFMETHOD("hoist_declarations", function(compressor){
        var hoist_funs = compressor.option("hoist_funs");
        var hoist_vars = compressor.option("hoist_vars");
        var self = this;
        if (hoist_funs || hoist_vars) {
            var dirs = [];
            var hoisted = [];
            var vars = new Dictionary(), vars_found = 0, var_decl = 0;
            // let's count var_decl first, we seem to waste a lot of
            // space if we hoist `var` when there's only one.
            self.walk(new TreeWalker(function(node){
                if (node instanceof AST_Scope && node !== self)
                    return true;
                if (node instanceof AST_Var) {
                    ++var_decl;
                    return true;
                }
            }));
            hoist_vars = hoist_vars && var_decl > 1;
            var tt = new TreeTransformer(
                function before(node) {
                    if (node !== self) {
                        if (node instanceof AST_Directive) {
                            dirs.push(node);
                            return make_node(AST_EmptyStatement, node);
                        }
                        if (node instanceof AST_Defun && hoist_funs) {
                            hoisted.push(node);
                            return make_node(AST_EmptyStatement, node);
                        }
                        if (node instanceof AST_Var && hoist_vars) {
                            node.definitions.forEach(function(def){
                                vars.set(def.name.name, def);
                                ++vars_found;
                            });
                            var seq = node.to_assignments();
                            var p = tt.parent();
                            if (p instanceof AST_ForIn && p.init === node) {
                                if (seq == null) return node.definitions[0].name;
                                return seq;
                            }
                            if (p instanceof AST_For && p.init === node) {
                                return seq;
                            }
                            if (!seq) return make_node(AST_EmptyStatement, node);
                            return make_node(AST_SimpleStatement, node, {
                                body: seq
                            });
                        }
                        if (node instanceof AST_Scope)
                            return node; // to avoid descending in nested scopes
                    }
                }
            );
            self = self.transform(tt);
            if (vars_found > 0) {
                // collect only vars which don't show up in self's arguments list
                var defs = [];
                vars.each(function(def, name){
                    if (self instanceof AST_Lambda
                        && find_if(function(x){ return x.name == def.name.name },
                                   self.argnames)) {
                        vars.del(name);
                    } else {
                        def = def.clone();
                        def.value = null;
                        defs.push(def);
                        vars.set(name, def);
                    }
                });
                if (defs.length > 0) {
                    // try to merge in assignments
                    for (var i = 0; i < self.body.length;) {
                        if (self.body[i] instanceof AST_SimpleStatement) {
                            var expr = self.body[i].body, sym, assign;
                            if (expr instanceof AST_Assign
                                && expr.operator == "="
                                && (sym = expr.left) instanceof AST_Symbol
                                && vars.has(sym.name))
                            {
                                var def = vars.get(sym.name);
                                if (def.value) break;
                                def.value = expr.right;
                                remove(defs, def);
                                defs.push(def);
                                self.body.splice(i, 1);
                                continue;
                            }
                            if (expr instanceof AST_Seq
                                && (assign = expr.car) instanceof AST_Assign
                                && assign.operator == "="
                                && (sym = assign.left) instanceof AST_Symbol
                                && vars.has(sym.name))
                            {
                                var def = vars.get(sym.name);
                                if (def.value) break;
                                def.value = assign.right;
                                remove(defs, def);
                                defs.push(def);
                                self.body[i].body = expr.cdr;
                                continue;
                            }
                        }
                        if (self.body[i] instanceof AST_EmptyStatement) {
                            self.body.splice(i, 1);
                            continue;
                        }
                        if (self.body[i] instanceof AST_BlockStatement) {
                            var tmp = [ i, 1 ].concat(self.body[i].body);
                            self.body.splice.apply(self.body, tmp);
                            continue;
                        }
                        break;
                    }
                    defs = make_node(AST_Var, self, {
                        definitions: defs
                    });
                    hoisted.push(defs);
                };
            }
            self.body = dirs.concat(hoisted, self.body);
        }
        return self;
    });

    OPT(AST_SimpleStatement, function(self, compressor){
        if (compressor.option("side_effects")) {
            if (!self.body.has_side_effects(compressor)) {
                compressor.warn("Dropping side-effect-free statement [{file}:{line},{col}]", self.start);
                return make_node(AST_EmptyStatement, self);
            }
        }
        return self;
    });

    OPT(AST_DWLoop, function(self, compressor){
        var cond = self.condition.evaluate(compressor);
        self.condition = cond[0];
        if (!compressor.option("loops")) return self;
        if (cond.length > 1) {
            if (cond[1]) {
                return make_node(AST_For, self, {
                    body: self.body
                });
            } else if (self instanceof AST_While) {
                if (compressor.option("dead_code")) {
                    var a = [];
                    extract_declarations_from_unreachable_code(compressor, self.body, a);
                    return make_node(AST_BlockStatement, self, { body: a });
                }
            }
        }
        return self;
    });

    function if_break_in_loop(self, compressor) {
        function drop_it(rest) {
            rest = as_statement_array(rest);
            if (self.body instanceof AST_BlockStatement) {
                self.body = self.body.clone();
                self.body.body = rest.concat(self.body.body.slice(1));
                self.body = self.body.transform(compressor);
            } else {
                self.body = make_node(AST_BlockStatement, self.body, {
                    body: rest
                }).transform(compressor);
            }
            if_break_in_loop(self, compressor);
        }
        var first = self.body instanceof AST_BlockStatement ? self.body.body[0] : self.body;
        if (first instanceof AST_If) {
            if (first.body instanceof AST_Break
                && compressor.loopcontrol_target(first.body.label) === self) {
                if (self.condition) {
                    self.condition = make_node(AST_Binary, self.condition, {
                        left: self.condition,
                        operator: "&&",
                        right: first.condition.negate(compressor),
                    });
                } else {
                    self.condition = first.condition.negate(compressor);
                }
                drop_it(first.alternative);
            }
            else if (first.alternative instanceof AST_Break
                     && compressor.loopcontrol_target(first.alternative.label) === self) {
                if (self.condition) {
                    self.condition = make_node(AST_Binary, self.condition, {
                        left: self.condition,
                        operator: "&&",
                        right: first.condition,
                    });
                } else {
                    self.condition = first.condition;
                }
                drop_it(first.body);
            }
        }
    };

    OPT(AST_While, function(self, compressor) {
        if (!compressor.option("loops")) return self;
        self = AST_DWLoop.prototype.optimize.call(self, compressor);
        if (self instanceof AST_While) {
            if_break_in_loop(self, compressor);
            self = make_node(AST_For, self, self).transform(compressor);
        }
        return self;
    });

    OPT(AST_For, function(self, compressor){
        var cond = self.condition;
        if (cond) {
            cond = cond.evaluate(compressor);
            self.condition = cond[0];
        }
        if (!compressor.option("loops")) return self;
        if (cond) {
            if (cond.length > 1 && !cond[1]) {
                if (compressor.option("dead_code")) {
                    var a = [];
                    if (self.init instanceof AST_Statement) {
                        a.push(self.init);
                    }
                    else if (self.init) {
                        a.push(make_node(AST_SimpleStatement, self.init, {
                            body: self.init
                        }));
                    }
                    extract_declarations_from_unreachable_code(compressor, self.body, a);
                    return make_node(AST_BlockStatement, self, { body: a });
                }
            }
        }
        if_break_in_loop(self, compressor);
        return self;
    });

    OPT(AST_If, function(self, compressor){
        if (!compressor.option("conditionals")) return self;
        // if condition can be statically determined, warn and drop
        // one of the blocks.  note, statically determined implies
        // “has no side effects”; also it doesn't work for cases like
        // `x && true`, though it probably should.
        var cond = self.condition.evaluate(compressor);
        self.condition = cond[0];
        if (cond.length > 1) {
            if (cond[1]) {
                compressor.warn("Condition always true [{file}:{line},{col}]", self.condition.start);
                if (compressor.option("dead_code")) {
                    var a = [];
                    if (self.alternative) {
                        extract_declarations_from_unreachable_code(compressor, self.alternative, a);
                    }
                    a.push(self.body);
                    return make_node(AST_BlockStatement, self, { body: a }).transform(compressor);
                }
            } else {
                compressor.warn("Condition always false [{file}:{line},{col}]", self.condition.start);
                if (compressor.option("dead_code")) {
                    var a = [];
                    extract_declarations_from_unreachable_code(compressor, self.body, a);
                    if (self.alternative) a.push(self.alternative);
                    return make_node(AST_BlockStatement, self, { body: a }).transform(compressor);
                }
            }
        }
        if (is_empty(self.alternative)) self.alternative = null;
        var negated = self.condition.negate(compressor);
        var negated_is_best = best_of(self.condition, negated) === negated;
        if (self.alternative && negated_is_best) {
            negated_is_best = false; // because we already do the switch here.
            self.condition = negated;
            var tmp = self.body;
            self.body = self.alternative || make_node(AST_EmptyStatement);
            self.alternative = tmp;
        }
        if (is_empty(self.body) && is_empty(self.alternative)) {
            return make_node(AST_SimpleStatement, self.condition, {
                body: self.condition
            }).transform(compressor);
        }
        if (self.body instanceof AST_SimpleStatement
            && self.alternative instanceof AST_SimpleStatement) {
            return make_node(AST_SimpleStatement, self, {
                body: make_node(AST_Conditional, self, {
                    condition   : self.condition,
                    consequent  : self.body.body,
                    alternative : self.alternative.body
                })
            }).transform(compressor);
        }
        if (is_empty(self.alternative) && self.body instanceof AST_SimpleStatement) {
            if (negated_is_best) return make_node(AST_SimpleStatement, self, {
                body: make_node(AST_Binary, self, {
                    operator : "||",
                    left     : negated,
                    right    : self.body.body
                })
            }).transform(compressor);
            return make_node(AST_SimpleStatement, self, {
                body: make_node(AST_Binary, self, {
                    operator : "&&",
                    left     : self.condition,
                    right    : self.body.body
                })
            }).transform(compressor);
        }
        if (self.body instanceof AST_EmptyStatement
            && self.alternative
            && self.alternative instanceof AST_SimpleStatement) {
            return make_node(AST_SimpleStatement, self, {
                body: make_node(AST_Binary, self, {
                    operator : "||",
                    left     : self.condition,
                    right    : self.alternative.body
                })
            }).transform(compressor);
        }
        if (self.body instanceof AST_Exit
            && self.alternative instanceof AST_Exit
            && self.body.TYPE == self.alternative.TYPE) {
            return make_node(self.body.CTOR, self, {
                value: make_node(AST_Conditional, self, {
                    condition   : self.condition,
                    consequent  : self.body.value || make_node(AST_Undefined, self.body).optimize(compressor),
                    alternative : self.alternative.value || make_node(AST_Undefined, self.alternative).optimize(compressor)
                })
            }).transform(compressor);
        }
        if (self.body instanceof AST_If
            && !self.body.alternative
            && !self.alternative) {
            self.condition = make_node(AST_Binary, self.condition, {
                operator: "&&",
                left: self.condition,
                right: self.body.condition
            }).transform(compressor);
            self.body = self.body.body;
        }
        if (aborts(self.body)) {
            if (self.alternative) {
                var alt = self.alternative;
                self.alternative = null;
                return make_node(AST_BlockStatement, self, {
                    body: [ self, alt ]
                }).transform(compressor);
            }
        }
        if (aborts(self.alternative)) {
            var body = self.body;
            self.body = self.alternative;
            self.condition = negated_is_best ? negated : self.condition.negate(compressor);
            self.alternative = null;
            return make_node(AST_BlockStatement, self, {
                body: [ self, body ]
            }).transform(compressor);
        }
        return self;
    });

    OPT(AST_Switch, function(self, compressor){
        if (self.body.length == 0 && compressor.option("conditionals")) {
            return make_node(AST_SimpleStatement, self, {
                body: self.expression
            }).transform(compressor);
        }
        for(;;) {
            var last_branch = self.body[self.body.length - 1];
            if (last_branch) {
                var stat = last_branch.body[last_branch.body.length - 1]; // last statement
                if (stat instanceof AST_Break && loop_body(compressor.loopcontrol_target(stat.label)) === self)
                    last_branch.body.pop();
                if (last_branch instanceof AST_Default && last_branch.body.length == 0) {
                    self.body.pop();
                    continue;
                }
            }
            break;
        }
        var exp = self.expression.evaluate(compressor);
        out: if (exp.length == 2) try {
            // constant expression
            self.expression = exp[0];
            if (!compressor.option("dead_code")) break out;
            var value = exp[1];
            var in_if = false;
            var in_block = false;
            var started = false;
            var stopped = false;
            var ruined = false;
            var tt = new TreeTransformer(function(node, descend, in_list){
                if (node instanceof AST_Lambda || node instanceof AST_SimpleStatement) {
                    // no need to descend these node types
                    return node;
                }
                else if (node instanceof AST_Switch && node === self) {
                    node = node.clone();
                    descend(node, this);
                    return ruined ? node : make_node(AST_BlockStatement, node, {
                        body: node.body.reduce(function(a, branch){
                            return a.concat(branch.body);
                        }, [])
                    }).transform(compressor);
                }
                else if (node instanceof AST_If || node instanceof AST_Try) {
                    var save = in_if;
                    in_if = !in_block;
                    descend(node, this);
                    in_if = save;
                    return node;
                }
                else if (node instanceof AST_StatementWithBody || node instanceof AST_Switch) {
                    var save = in_block;
                    in_block = true;
                    descend(node, this);
                    in_block = save;
                    return node;
                }
                else if (node instanceof AST_Break && this.loopcontrol_target(node.label) === self) {
                    if (in_if) {
                        ruined = true;
                        return node;
                    }
                    if (in_block) return node;
                    stopped = true;
                    return in_list ? MAP.skip : make_node(AST_EmptyStatement, node);
                }
                else if (node instanceof AST_SwitchBranch && this.parent() === self) {
                    if (stopped) return MAP.skip;
                    if (node instanceof AST_Case) {
                        var exp = node.expression.evaluate(compressor);
                        if (exp.length < 2) {
                            // got a case with non-constant expression, baling out
                            throw self;
                        }
                        if (exp[1] === value || started) {
                            started = true;
                            if (aborts(node)) stopped = true;
                            descend(node, this);
                            return node;
                        }
                        return MAP.skip;
                    }
                    descend(node, this);
                    return node;
                }
            });
            tt.stack = compressor.stack.slice(); // so that's able to see parent nodes
            self = self.transform(tt);
        } catch(ex) {
            if (ex !== self) throw ex;
        }
        return self;
    });

    OPT(AST_Case, function(self, compressor){
        self.body = tighten_body(self.body, compressor);
        return self;
    });

    OPT(AST_Try, function(self, compressor){
        self.body = tighten_body(self.body, compressor);
        return self;
    });

    AST_Definitions.DEFMETHOD("remove_initializers", function(){
        this.definitions.forEach(function(def){ def.value = null });
    });

    AST_Definitions.DEFMETHOD("to_assignments", function(){
        var assignments = this.definitions.reduce(function(a, def){
            if (def.value) {
                var name = make_node(AST_SymbolRef, def.name, def.name);
                a.push(make_node(AST_Assign, def, {
                    operator : "=",
                    left     : name,
                    right    : def.value
                }));
            }
            return a;
        }, []);
        if (assignments.length == 0) return null;
        return AST_Seq.from_array(assignments);
    });

    OPT(AST_Definitions, function(self, compressor){
        if (self.definitions.length == 0)
            return make_node(AST_EmptyStatement, self);
        return self;
    });

    OPT(AST_Function, function(self, compressor){
        self = AST_Lambda.prototype.optimize.call(self, compressor);
        if (compressor.option("unused")) {
            if (self.name && self.name.unreferenced()) {
                self.name = null;
            }
        }
        return self;
    });

    OPT(AST_Call, function(self, compressor){
        if (compressor.option("unsafe")) {
            var exp = self.expression;
            if (exp instanceof AST_SymbolRef && exp.undeclared()) {
                switch (exp.name) {
                  case "Array":
                    if (self.args.length != 1) {
                        return make_node(AST_Array, self, {
                            elements: self.args
                        }).transform(compressor);
                    }
                    break;
                  case "Object":
                    if (self.args.length == 0) {
                        return make_node(AST_Object, self, {
                            properties: []
                        });
                    }
                    break;
                  case "String":
                    if (self.args.length == 0) return make_node(AST_String, self, {
                        value: ""
                    });
                    if (self.args.length <= 1) return make_node(AST_Binary, self, {
                        left: self.args[0],
                        operator: "+",
                        right: make_node(AST_String, self, { value: "" })
                    }).transform(compressor);
                    break;
                  case "Number":
                    if (self.args.length == 0) return make_node(AST_Number, self, {
                        value: 0
                    });
                    if (self.args.length == 1) return make_node(AST_UnaryPrefix, self, {
                        expression: self.args[0],
                        operator: "+"
                    }).transform(compressor);
                  case "Boolean":
                    if (self.args.length == 0) return make_node(AST_False, self);
                    if (self.args.length == 1) return make_node(AST_UnaryPrefix, self, {
                        expression: make_node(AST_UnaryPrefix, null, {
                            expression: self.args[0],
                            operator: "!"
                        }),
                        operator: "!"
                    }).transform(compressor);
                    break;
                  case "Function":
                    if (all(self.args, function(x){ return x instanceof AST_String })) {
                        // quite a corner-case, but we can handle it:
                        //   https://github.com/mishoo/UglifyJS2/issues/203
                        // if the code argument is a constant, then we can minify it.
                        try {
                            var code = "(function(" + self.args.slice(0, -1).map(function(arg){
                                return arg.value;
                            }).join(",") + "){" + self.args[self.args.length - 1].value + "})()";
                            var ast = parse(code);
                            ast.figure_out_scope({ screw_ie8: compressor.option("screw_ie8") });
                            var comp = new Compressor(compressor.options);
                            ast = ast.transform(comp);
                            ast.figure_out_scope({ screw_ie8: compressor.option("screw_ie8") });
                            ast.mangle_names();
                            var fun;
                            try {
                                ast.walk(new TreeWalker(function(node){
                                    if (node instanceof AST_Lambda) {
                                        fun = node;
                                        throw ast;
                                    }
                                }));
                            } catch(ex) {
                                if (ex !== ast) throw ex;
                            };
                            var args = fun.argnames.map(function(arg, i){
                                return make_node(AST_String, self.args[i], {
                                    value: arg.print_to_string()
                                });
                            });
                            var code = OutputStream();
                            AST_BlockStatement.prototype._codegen.call(fun, fun, code);
                            code = code.toString().replace(/^\{|\}$/g, "");
                            args.push(make_node(AST_String, self.args[self.args.length - 1], {
                                value: code
                            }));
                            self.args = args;
                            return self;
                        } catch(ex) {
                            if (ex instanceof JS_Parse_Error) {
                                compressor.warn("Error parsing code passed to new Function [{file}:{line},{col}]", self.args[self.args.length - 1].start);
                                compressor.warn(ex.toString());
                            } else {
                                console.log(ex);
                                throw ex;
                            }
                        }
                    }
                    break;
                }
            }
            else if (exp instanceof AST_Dot && exp.property == "toString" && self.args.length == 0) {
                return make_node(AST_Binary, self, {
                    left: make_node(AST_String, self, { value: "" }),
                    operator: "+",
                    right: exp.expression
                }).transform(compressor);
            }
            else if (exp instanceof AST_Dot && exp.expression instanceof AST_Array && exp.property == "join") EXIT: {
                var separator = self.args.length == 0 ? "," : self.args[0].evaluate(compressor)[1];
                if (separator == null) break EXIT; // not a constant
                var elements = exp.expression.elements.reduce(function(a, el){
                    el = el.evaluate(compressor);
                    if (a.length == 0 || el.length == 1) {
                        a.push(el);
                    } else {
                        var last = a[a.length - 1];
                        if (last.length == 2) {
                            // it's a constant
                            var val = "" + last[1] + separator + el[1];
                            a[a.length - 1] = [ make_node_from_constant(compressor, val, last[0]), val ];
                        } else {
                            a.push(el);
                        }
                    }
                    return a;
                }, []);
                if (elements.length == 0) return make_node(AST_String, self, { value: "" });
                if (elements.length == 1) return elements[0][0];
                if (separator == "") {
                    var first;
                    if (elements[0][0] instanceof AST_String
                        || elements[1][0] instanceof AST_String) {
                        first = elements.shift()[0];
                    } else {
                        first = make_node(AST_String, self, { value: "" });
                    }
                    return elements.reduce(function(prev, el){
                        return make_node(AST_Binary, el[0], {
                            operator : "+",
                            left     : prev,
                            right    : el[0],
                        });
                    }, first).transform(compressor);
                }
                // need this awkward cloning to not affect original element
                // best_of will decide which one to get through.
                var node = self.clone();
                node.expression = node.expression.clone();
                node.expression.expression = node.expression.expression.clone();
                node.expression.expression.elements = elements.map(function(el){
                    return el[0];
                });
                return best_of(self, node);
            }
        }
        if (compressor.option("side_effects")) {
            if (self.expression instanceof AST_Function
                && self.args.length == 0
                && !AST_Block.prototype.has_side_effects.call(self.expression, compressor)) {
                return make_node(AST_Undefined, self).transform(compressor);
            }
        }
        if (compressor.option("drop_console")) {
            if (self.expression instanceof AST_PropAccess &&
                self.expression.expression instanceof AST_SymbolRef &&
                self.expression.expression.name == "console" &&
                self.expression.expression.undeclared()) {
                return make_node(AST_Undefined, self).transform(compressor);
            }
        }
        return self.evaluate(compressor)[0];
    });

    OPT(AST_New, function(self, compressor){
        if (compressor.option("unsafe")) {
            var exp = self.expression;
            if (exp instanceof AST_SymbolRef && exp.undeclared()) {
                switch (exp.name) {
                  case "Object":
                  case "RegExp":
                  case "Function":
                  case "Error":
                  case "Array":
                    return make_node(AST_Call, self, self).transform(compressor);
                }
            }
        }
        return self;
    });

    OPT(AST_Seq, function(self, compressor){
        if (!compressor.option("side_effects"))
            return self;
        if (!self.car.has_side_effects(compressor)) {
            // we shouldn't compress (1,eval)(something) to
            // eval(something) because that changes the meaning of
            // eval (becomes lexical instead of global).
            var p;
            if (!(self.cdr instanceof AST_SymbolRef
                  && self.cdr.name == "eval"
                  && self.cdr.undeclared()
                  && (p = compressor.parent()) instanceof AST_Call
                  && p.expression === self)) {
                return self.cdr;
            }
        }
        if (compressor.option("cascade")) {
            if (self.car instanceof AST_Assign
                && !self.car.left.has_side_effects(compressor)) {
                if (self.car.left.equivalent_to(self.cdr)) {
                    return self.car;
                }
                if (self.cdr instanceof AST_Call
                    && self.cdr.expression.equivalent_to(self.car.left)) {
                    self.cdr.expression = self.car;
                    return self.cdr;
                }
            }
            if (!self.car.has_side_effects(compressor)
                && !self.cdr.has_side_effects(compressor)
                && self.car.equivalent_to(self.cdr)) {
                return self.car;
            }
        }
        if (self.cdr instanceof AST_UnaryPrefix
            && self.cdr.operator == "void"
            && !self.cdr.expression.has_side_effects(compressor)) {
            self.cdr.operator = self.car;
            return self.cdr;
        }
        if (self.cdr instanceof AST_Undefined) {
            return make_node(AST_UnaryPrefix, self, {
                operator   : "void",
                expression : self.car
            });
        }
        return self;
    });

    AST_Unary.DEFMETHOD("lift_sequences", function(compressor){
        if (compressor.option("sequences")) {
            if (this.expression instanceof AST_Seq) {
                var seq = this.expression;
                var x = seq.to_array();
                this.expression = x.pop();
                x.push(this);
                seq = AST_Seq.from_array(x).transform(compressor);
                return seq;
            }
        }
        return this;
    });

    OPT(AST_UnaryPostfix, function(self, compressor){
        return self.lift_sequences(compressor);
    });

    OPT(AST_UnaryPrefix, function(self, compressor){
        self = self.lift_sequences(compressor);
        var e = self.expression;
        if (compressor.option("booleans") && compressor.in_boolean_context()) {
            switch (self.operator) {
              case "!":
                if (e instanceof AST_UnaryPrefix && e.operator == "!") {
                    // !!foo ==> foo, if we're in boolean context
                    return e.expression;
                }
                break;
              case "typeof":
                // typeof always returns a non-empty string, thus it's
                // always true in booleans
                compressor.warn("Boolean expression always true [{file}:{line},{col}]", self.start);
                return make_node(AST_True, self);
            }
            if (e instanceof AST_Binary && self.operator == "!") {
                self = best_of(self, e.negate(compressor));
            }
        }
        return self.evaluate(compressor)[0];
    });

    function has_side_effects_or_prop_access(node, compressor) {
        var save_pure_getters = compressor.option("pure_getters");
        compressor.options.pure_getters = false;
        var ret = node.has_side_effects(compressor);
        compressor.options.pure_getters = save_pure_getters;
        return ret;
    }

    AST_Binary.DEFMETHOD("lift_sequences", function(compressor){
        if (compressor.option("sequences")) {
            if (this.left instanceof AST_Seq) {
                var seq = this.left;
                var x = seq.to_array();
                this.left = x.pop();
                x.push(this);
                seq = AST_Seq.from_array(x).transform(compressor);
                return seq;
            }
            if (this.right instanceof AST_Seq
                && this instanceof AST_Assign
                && !has_side_effects_or_prop_access(this.left, compressor)) {
                var seq = this.right;
                var x = seq.to_array();
                this.right = x.pop();
                x.push(this);
                seq = AST_Seq.from_array(x).transform(compressor);
                return seq;
            }
        }
        return this;
    });

    var commutativeOperators = makePredicate("== === != !== * & | ^");

    OPT(AST_Binary, function(self, compressor){
        var reverse = compressor.has_directive("use asm") ? noop
            : function(op, force) {
                if (force || !(self.left.has_side_effects(compressor) || self.right.has_side_effects(compressor))) {
                    if (op) self.operator = op;
                    var tmp = self.left;
                    self.left = self.right;
                    self.right = tmp;
                }
            };
        if (commutativeOperators(self.operator)) {
            if (self.right instanceof AST_Constant
                && !(self.left instanceof AST_Constant)) {
                // if right is a constant, whatever side effects the
                // left side might have could not influence the
                // result.  hence, force switch.

                if (!(self.left instanceof AST_Binary
                      && PRECEDENCE[self.left.operator] >= PRECEDENCE[self.operator])) {
                    reverse(null, true);
                }
            }
            if (/^[!=]==?$/.test(self.operator)) {
                if (self.left instanceof AST_SymbolRef && self.right instanceof AST_Conditional) {
                    if (self.right.consequent instanceof AST_SymbolRef
                        && self.right.consequent.definition() === self.left.definition()) {
                        if (/^==/.test(self.operator)) return self.right.condition;
                        if (/^!=/.test(self.operator)) return self.right.condition.negate(compressor);
                    }
                    if (self.right.alternative instanceof AST_SymbolRef
                        && self.right.alternative.definition() === self.left.definition()) {
                        if (/^==/.test(self.operator)) return self.right.condition.negate(compressor);
                        if (/^!=/.test(self.operator)) return self.right.condition;
                    }
                }
                if (self.right instanceof AST_SymbolRef && self.left instanceof AST_Conditional) {
                    if (self.left.consequent instanceof AST_SymbolRef
                        && self.left.consequent.definition() === self.right.definition()) {
                        if (/^==/.test(self.operator)) return self.left.condition;
                        if (/^!=/.test(self.operator)) return self.left.condition.negate(compressor);
                    }
                    if (self.left.alternative instanceof AST_SymbolRef
                        && self.left.alternative.definition() === self.right.definition()) {
                        if (/^==/.test(self.operator)) return self.left.condition.negate(compressor);
                        if (/^!=/.test(self.operator)) return self.left.condition;
                    }
                }
            }
        }
        self = self.lift_sequences(compressor);
        if (compressor.option("comparisons")) switch (self.operator) {
          case "===":
          case "!==":
            if ((self.left.is_string(compressor) && self.right.is_string(compressor)) ||
                (self.left.is_boolean() && self.right.is_boolean())) {
                self.operator = self.operator.substr(0, 2);
            }
            // XXX: intentionally falling down to the next case
          case "==":
          case "!=":
            if (self.left instanceof AST_String
                && self.left.value == "undefined"
                && self.right instanceof AST_UnaryPrefix
                && self.right.operator == "typeof"
                && compressor.option("unsafe")) {
                if (!(self.right.expression instanceof AST_SymbolRef)
                    || !self.right.expression.undeclared()) {
                    self.right = self.right.expression;
                    self.left = make_node(AST_Undefined, self.left).optimize(compressor);
                    if (self.operator.length == 2) self.operator += "=";
                }
            }
            break;
        }
        if (compressor.option("booleans") && compressor.in_boolean_context()) switch (self.operator) {
          case "&&":
            var ll = self.left.evaluate(compressor);
            var rr = self.right.evaluate(compressor);
            if ((ll.length > 1 && !ll[1]) || (rr.length > 1 && !rr[1])) {
                compressor.warn("Boolean && always false [{file}:{line},{col}]", self.start);
                return make_node(AST_False, self);
            }
            if (ll.length > 1 && ll[1]) {
                return rr[0];
            }
            if (rr.length > 1 && rr[1]) {
                return ll[0];
            }
            break;
          case "||":
            var ll = self.left.evaluate(compressor);
            var rr = self.right.evaluate(compressor);
            if ((ll.length > 1 && ll[1]) || (rr.length > 1 && rr[1])) {
                compressor.warn("Boolean || always true [{file}:{line},{col}]", self.start);
                return make_node(AST_True, self);
            }
            if (ll.length > 1 && !ll[1]) {
                return rr[0];
            }
            if (rr.length > 1 && !rr[1]) {
                return ll[0];
            }
            break;
          case "+":
            var ll = self.left.evaluate(compressor);
            var rr = self.right.evaluate(compressor);
            if ((ll.length > 1 && ll[0] instanceof AST_String && ll[1]) ||
                (rr.length > 1 && rr[0] instanceof AST_String && rr[1])) {
                compressor.warn("+ in boolean context always true [{file}:{line},{col}]", self.start);
                return make_node(AST_True, self);
            }
            break;
        }
        if (compressor.option("comparisons")) {
            if (!(compressor.parent() instanceof AST_Binary)
                || compressor.parent() instanceof AST_Assign) {
                var negated = make_node(AST_UnaryPrefix, self, {
                    operator: "!",
                    expression: self.negate(compressor)
                });
                self = best_of(self, negated);
            }
            switch (self.operator) {
              case "<": reverse(">"); break;
              case "<=": reverse(">="); break;
            }
        }
        if (self.operator == "+" && self.right instanceof AST_String
            && self.right.getValue() === "" && self.left instanceof AST_Binary
            && self.left.operator == "+" && self.left.is_string(compressor)) {
            return self.left;
        }
        if (compressor.option("evaluate")) {
            if (self.operator == "+") {
                if (self.left instanceof AST_Constant
                    && self.right instanceof AST_Binary
                    && self.right.operator == "+"
                    && self.right.left instanceof AST_Constant
                    && self.right.is_string(compressor)) {
                    self = make_node(AST_Binary, self, {
                        operator: "+",
                        left: make_node(AST_String, null, {
                            value: "" + self.left.getValue() + self.right.left.getValue(),
                            start: self.left.start,
                            end: self.right.left.end
                        }),
                        right: self.right.right
                    });
                }
                if (self.right instanceof AST_Constant
                    && self.left instanceof AST_Binary
                    && self.left.operator == "+"
                    && self.left.right instanceof AST_Constant
                    && self.left.is_string(compressor)) {
                    self = make_node(AST_Binary, self, {
                        operator: "+",
                        left: self.left.left,
                        right: make_node(AST_String, null, {
                            value: "" + self.left.right.getValue() + self.right.getValue(),
                            start: self.left.right.start,
                            end: self.right.end
                        })
                    });
                }
                if (self.left instanceof AST_Binary
                    && self.left.operator == "+"
                    && self.left.is_string(compressor)
                    && self.left.right instanceof AST_Constant
                    && self.right instanceof AST_Binary
                    && self.right.operator == "+"
                    && self.right.left instanceof AST_Constant
                    && self.right.is_string(compressor)) {
                    self = make_node(AST_Binary, self, {
                        operator: "+",
                        left: make_node(AST_Binary, self.left, {
                            operator: "+",
                            left: self.left.left,
                            right: make_node(AST_String, null, {
                                value: "" + self.left.right.getValue() + self.right.left.getValue(),
                                start: self.left.right.start,
                                end: self.right.left.end
                            })
                        }),
                        right: self.right.right
                    });
                }
            }
        }
        // x * (y * z)  ==>  x * y * z
        if (self.right instanceof AST_Binary
            && self.right.operator == self.operator
            && (self.operator == "*" || self.operator == "&&" || self.operator == "||"))
        {
            self.left = make_node(AST_Binary, self.left, {
                operator : self.operator,
                left     : self.left,
                right    : self.right.left
            });
            self.right = self.right.right;
            return self.transform(compressor);
        }
        return self.evaluate(compressor)[0];
    });

    OPT(AST_SymbolRef, function(self, compressor){
        if (self.undeclared()) {
            var defines = compressor.option("global_defs");
            if (defines && defines.hasOwnProperty(self.name)) {
                return make_node_from_constant(compressor, defines[self.name], self);
            }
            switch (self.name) {
              case "undefined":
                return make_node(AST_Undefined, self);
              case "NaN":
                return make_node(AST_NaN, self);
              case "Infinity":
                return make_node(AST_Infinity, self);
            }
        }
        return self;
    });

    OPT(AST_Undefined, function(self, compressor){
        if (compressor.option("unsafe")) {
            var scope = compressor.find_parent(AST_Scope);
            var undef = scope.find_variable("undefined");
            if (undef) {
                var ref = make_node(AST_SymbolRef, self, {
                    name   : "undefined",
                    scope  : scope,
                    thedef : undef
                });
                ref.reference();
                return ref;
            }
        }
        return self;
    });

    var ASSIGN_OPS = [ '+', '-', '/', '*', '%', '>>', '<<', '>>>', '|', '^', '&' ];
    OPT(AST_Assign, function(self, compressor){
        self = self.lift_sequences(compressor);
        if (self.operator == "="
            && self.left instanceof AST_SymbolRef
            && self.right instanceof AST_Binary
            && self.right.left instanceof AST_SymbolRef
            && self.right.left.name == self.left.name
            && member(self.right.operator, ASSIGN_OPS)) {
            self.operator = self.right.operator + "=";
            self.right = self.right.right;
        }
        return self;
    });

    OPT(AST_Conditional, function(self, compressor){
        if (!compressor.option("conditionals")) return self;
        if (self.condition instanceof AST_Seq) {
            var car = self.condition.car;
            self.condition = self.condition.cdr;
            return AST_Seq.cons(car, self);
        }
        var cond = self.condition.evaluate(compressor);
        if (cond.length > 1) {
            if (cond[1]) {
                compressor.warn("Condition always true [{file}:{line},{col}]", self.start);
                return self.consequent;
            } else {
                compressor.warn("Condition always false [{file}:{line},{col}]", self.start);
                return self.alternative;
            }
        }
        var negated = cond[0].negate(compressor);
        if (best_of(cond[0], negated) === negated) {
            self = make_node(AST_Conditional, self, {
                condition: negated,
                consequent: self.alternative,
                alternative: self.consequent
            });
        }
        var consequent = self.consequent;
        var alternative = self.alternative;
        if (consequent instanceof AST_Assign
            && alternative instanceof AST_Assign
            && consequent.operator == alternative.operator
            && consequent.left.equivalent_to(alternative.left)
           ) {
            /*
             * Stuff like this:
             * if (foo) exp = something; else exp = something_else;
             * ==>
             * exp = foo ? something : something_else;
             */
            return make_node(AST_Assign, self, {
                operator: consequent.operator,
                left: consequent.left,
                right: make_node(AST_Conditional, self, {
                    condition: self.condition,
                    consequent: consequent.right,
                    alternative: alternative.right
                })
            });
        }
        if (consequent instanceof AST_Call
            && alternative.TYPE === consequent.TYPE
            && consequent.args.length == alternative.args.length
            && consequent.expression.equivalent_to(alternative.expression)) {
            if (consequent.args.length == 0) {
                return make_node(AST_Seq, self, {
                    car: self.condition,
                    cdr: consequent
                });
            }
            if (consequent.args.length == 1) {
                consequent.args[0] = make_node(AST_Conditional, self, {
                    condition: self.condition,
                    consequent: consequent.args[0],
                    alternative: alternative.args[0]
                });
                return consequent;
            }
        }
        // x?y?z:a:a --> x&&y?z:a
        if (consequent instanceof AST_Conditional
            && consequent.alternative.equivalent_to(alternative)) {
            return make_node(AST_Conditional, self, {
                condition: make_node(AST_Binary, self, {
                    left: self.condition,
                    operator: "&&",
                    right: consequent.condition
                }),
                consequent: consequent.consequent,
                alternative: alternative
            });
        }
        return self;
    });

    OPT(AST_Boolean, function(self, compressor){
        if (compressor.option("booleans")) {
            var p = compressor.parent();
            if (p instanceof AST_Binary && (p.operator == "=="
                                            || p.operator == "!=")) {
                compressor.warn("Non-strict equality against boolean: {operator} {value} [{file}:{line},{col}]", {
                    operator : p.operator,
                    value    : self.value,
                    file     : p.start.file,
                    line     : p.start.line,
                    col      : p.start.col,
                });
                return make_node(AST_Number, self, {
                    value: +self.value
                });
            }
            return make_node(AST_UnaryPrefix, self, {
                operator: "!",
                expression: make_node(AST_Number, self, {
                    value: 1 - self.value
                })
            });
        }
        return self;
    });

    OPT(AST_Sub, function(self, compressor){
        var prop = self.property;
        if (prop instanceof AST_String && compressor.option("properties")) {
            prop = prop.getValue();
            if (RESERVED_WORDS(prop) ? compressor.option("screw_ie8") : is_identifier_string(prop)) {
                return make_node(AST_Dot, self, {
                    expression : self.expression,
                    property   : prop
                }).optimize(compressor);
            }
            var v = parseFloat(prop);
            if (!isNaN(v) && v.toString() == prop) {
                self.property = make_node(AST_Number, self.property, {
                    value: v
                });
            }
        }
        return self;
    });

    OPT(AST_Dot, function(self, compressor){
        return self.evaluate(compressor)[0];
    });

    function literals_in_boolean_context(self, compressor) {
        if (compressor.option("booleans") && compressor.in_boolean_context()) {
            return make_node(AST_True, self);
        }
        return self;
    };
    OPT(AST_Array, literals_in_boolean_context);
    OPT(AST_Object, literals_in_boolean_context);
    OPT(AST_RegExp, literals_in_boolean_context);

})();

/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS2

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

// a small wrapper around fitzgen's source-map library
function SourceMap(options) {
    options = defaults(options, {
        file : null,
        root : null,
        orig : null,

        orig_line_diff : 0,
        dest_line_diff : 0,
    });
    var generator = new MOZ_SourceMap.SourceMapGenerator({
        file       : options.file,
        sourceRoot : options.root
    });
    var orig_map = options.orig && new MOZ_SourceMap.SourceMapConsumer(options.orig);
    function add(source, gen_line, gen_col, orig_line, orig_col, name) {
        if (orig_map) {
            var info = orig_map.originalPositionFor({
                line: orig_line,
                column: orig_col
            });
            if (info.source === null) {
                return;
            }
            source = info.source;
            orig_line = info.line;
            orig_col = info.column;
            name = info.name;
        }
        generator.addMapping({
            generated : { line: gen_line + options.dest_line_diff, column: gen_col },
            original  : { line: orig_line + options.orig_line_diff, column: orig_col },
            source    : source,
            name      : name
        });
    };
    return {
        add        : add,
        get        : function() { return generator },
        toString   : function() { return generator.toString() }
    };
};

/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS2

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

(function(){

    var MOZ_TO_ME = {
        TryStatement : function(M) {
            return new AST_Try({
                start    : my_start_token(M),
                end      : my_end_token(M),
                body     : from_moz(M.block).body,
                bcatch   : from_moz(M.handlers ? M.handlers[0] : M.handler),
                bfinally : M.finalizer ? new AST_Finally(from_moz(M.finalizer)) : null
            });
        },
        CatchClause : function(M) {
            return new AST_Catch({
                start   : my_start_token(M),
                end     : my_end_token(M),
                argname : from_moz(M.param),
                body    : from_moz(M.body).body
            });
        },
        ObjectExpression : function(M) {
            return new AST_Object({
                start      : my_start_token(M),
                end        : my_end_token(M),
                properties : M.properties.map(function(prop){
                    var key = prop.key;
                    var name = key.type == "Identifier" ? key.name : key.value;
                    var args = {
                        start    : my_start_token(key),
                        end      : my_end_token(prop.value),
                        key      : name,
                        value    : from_moz(prop.value)
                    };
                    switch (prop.kind) {
                      case "init":
                        return new AST_ObjectKeyVal(args);
                      case "set":
                        args.value.name = from_moz(key);
                        return new AST_ObjectSetter(args);
                      case "get":
                        args.value.name = from_moz(key);
                        return new AST_ObjectGetter(args);
                    }
                })
            });
        },
        SequenceExpression : function(M) {
            return AST_Seq.from_array(M.expressions.map(from_moz));
        },
        MemberExpression : function(M) {
            return new (M.computed ? AST_Sub : AST_Dot)({
                start      : my_start_token(M),
                end        : my_end_token(M),
                property   : M.computed ? from_moz(M.property) : M.property.name,
                expression : from_moz(M.object)
            });
        },
        SwitchCase : function(M) {
            return new (M.test ? AST_Case : AST_Default)({
                start      : my_start_token(M),
                end        : my_end_token(M),
                expression : from_moz(M.test),
                body       : M.consequent.map(from_moz)
            });
        },
        Literal : function(M) {
            var val = M.value, args = {
                start  : my_start_token(M),
                end    : my_end_token(M)
            };
            if (val === null) return new AST_Null(args);
            switch (typeof val) {
              case "string":
                args.value = val;
                return new AST_String(args);
              case "number":
                args.value = val;
                return new AST_Number(args);
              case "boolean":
                return new (val ? AST_True : AST_False)(args);
              default:
                args.value = val;
                return new AST_RegExp(args);
            }
        },
        UnaryExpression: From_Moz_Unary,
        UpdateExpression: From_Moz_Unary,
        Identifier: function(M) {
            var p = FROM_MOZ_STACK[FROM_MOZ_STACK.length - 2];
            return new (M.name == "this" ? AST_This
                        : p.type == "LabeledStatement" ? AST_Label
                        : p.type == "VariableDeclarator" && p.id === M ? (p.kind == "const" ? AST_SymbolConst : AST_SymbolVar)
                        : p.type == "FunctionExpression" ? (p.id === M ? AST_SymbolLambda : AST_SymbolFunarg)
                        : p.type == "FunctionDeclaration" ? (p.id === M ? AST_SymbolDefun : AST_SymbolFunarg)
                        : p.type == "CatchClause" ? AST_SymbolCatch
                        : p.type == "BreakStatement" || p.type == "ContinueStatement" ? AST_LabelRef
                        : AST_SymbolRef)({
                            start : my_start_token(M),
                            end   : my_end_token(M),
                            name  : M.name
                        });
        }
    };

    function From_Moz_Unary(M) {
        var prefix = "prefix" in M ? M.prefix
            : M.type == "UnaryExpression" ? true : false;
        return new (prefix ? AST_UnaryPrefix : AST_UnaryPostfix)({
            start      : my_start_token(M),
            end        : my_end_token(M),
            operator   : M.operator,
            expression : from_moz(M.argument)
        });
    };

    var ME_TO_MOZ = {};

    map("Node", AST_Node);
    map("Program", AST_Toplevel, "body@body");
    map("Function", AST_Function, "id>name, params@argnames, body%body");
    map("EmptyStatement", AST_EmptyStatement);
    map("BlockStatement", AST_BlockStatement, "body@body");
    map("ExpressionStatement", AST_SimpleStatement, "expression>body");
    map("IfStatement", AST_If, "test>condition, consequent>body, alternate>alternative");
    map("LabeledStatement", AST_LabeledStatement, "label>label, body>body");
    map("BreakStatement", AST_Break, "label>label");
    map("ContinueStatement", AST_Continue, "label>label");
    map("WithStatement", AST_With, "object>expression, body>body");
    map("SwitchStatement", AST_Switch, "discriminant>expression, cases@body");
    map("ReturnStatement", AST_Return, "argument>value");
    map("ThrowStatement", AST_Throw, "argument>value");
    map("WhileStatement", AST_While, "test>condition, body>body");
    map("DoWhileStatement", AST_Do, "test>condition, body>body");
    map("ForStatement", AST_For, "init>init, test>condition, update>step, body>body");
    map("ForInStatement", AST_ForIn, "left>init, right>object, body>body");
    map("DebuggerStatement", AST_Debugger);
    map("FunctionDeclaration", AST_Defun, "id>name, params@argnames, body%body");
    map("VariableDeclaration", AST_Var, "declarations@definitions");
    map("VariableDeclarator", AST_VarDef, "id>name, init>value");

    map("ThisExpression", AST_This);
    map("ArrayExpression", AST_Array, "elements@elements");
    map("FunctionExpression", AST_Function, "id>name, params@argnames, body%body");
    map("BinaryExpression", AST_Binary, "operator=operator, left>left, right>right");
    map("AssignmentExpression", AST_Assign, "operator=operator, left>left, right>right");
    map("LogicalExpression", AST_Binary, "operator=operator, left>left, right>right");
    map("ConditionalExpression", AST_Conditional, "test>condition, consequent>consequent, alternate>alternative");
    map("NewExpression", AST_New, "callee>expression, arguments@args");
    map("CallExpression", AST_Call, "callee>expression, arguments@args");

    /* -----[ tools ]----- */

    function my_start_token(moznode) {
        return new AST_Token({
            file   : moznode.loc && moznode.loc.source,
            line   : moznode.loc && moznode.loc.start.line,
            col    : moznode.loc && moznode.loc.start.column,
            pos    : moznode.start,
            endpos : moznode.start
        });
    };

    function my_end_token(moznode) {
        return new AST_Token({
            file   : moznode.loc && moznode.loc.source,
            line   : moznode.loc && moznode.loc.end.line,
            col    : moznode.loc && moznode.loc.end.column,
            pos    : moznode.end,
            endpos : moznode.end
        });
    };

    function map(moztype, mytype, propmap) {
        var moz_to_me = "function From_Moz_" + moztype + "(M){\n";
        moz_to_me += "return new mytype({\n" +
            "start: my_start_token(M),\n" +
            "end: my_end_token(M)";

        if (propmap) propmap.split(/\s*,\s*/).forEach(function(prop){
            var m = /([a-z0-9$_]+)(=|@|>|%)([a-z0-9$_]+)/i.exec(prop);
            if (!m) throw new Error("Can't understand property map: " + prop);
            var moz = "M." + m[1], how = m[2], my = m[3];
            moz_to_me += ",\n" + my + ": ";
            if (how == "@") {
                moz_to_me += moz + ".map(from_moz)";
            } else if (how == ">") {
                moz_to_me += "from_moz(" + moz + ")";
            } else if (how == "=") {
                moz_to_me += moz;
            } else if (how == "%") {
                moz_to_me += "from_moz(" + moz + ").body";
            } else throw new Error("Can't understand operator in propmap: " + prop);
        });
        moz_to_me += "\n})}";

        // moz_to_me = parse(moz_to_me).print_to_string({ beautify: true });
        // console.log(moz_to_me);

        moz_to_me = new Function("mytype", "my_start_token", "my_end_token", "from_moz", "return(" + moz_to_me + ")")(
            mytype, my_start_token, my_end_token, from_moz
        );
        return MOZ_TO_ME[moztype] = moz_to_me;
    };

    var FROM_MOZ_STACK = null;

    function from_moz(node) {
        FROM_MOZ_STACK.push(node);
        var ret = node != null ? MOZ_TO_ME[node.type](node) : null;
        FROM_MOZ_STACK.pop();
        return ret;
    };

    AST_Node.from_mozilla_ast = function(node){
        var save_stack = FROM_MOZ_STACK;
        FROM_MOZ_STACK = [];
        var ast = from_moz(node);
        FROM_MOZ_STACK = save_stack;
        return ast;
    };

})();


exports.sys = sys;
exports.MOZ_SourceMap = MOZ_SourceMap;
exports.UglifyJS = UglifyJS;
exports.array_to_hash = array_to_hash;
exports.slice = slice;
exports.characters = characters;
exports.member = member;
exports.find_if = find_if;
exports.repeat_string = repeat_string;
exports.DefaultsError = DefaultsError;
exports.defaults = defaults;
exports.merge = merge;
exports.noop = noop;
exports.MAP = MAP;
exports.push_uniq = push_uniq;
exports.string_template = string_template;
exports.remove = remove;
exports.mergeSort = mergeSort;
exports.set_difference = set_difference;
exports.set_intersection = set_intersection;
exports.makePredicate = makePredicate;
exports.all = all;
exports.Dictionary = Dictionary;
exports.DEFNODE = DEFNODE;
exports.AST_Token = AST_Token;
exports.AST_Node = AST_Node;
exports.AST_Statement = AST_Statement;
exports.AST_Debugger = AST_Debugger;
exports.AST_Directive = AST_Directive;
exports.AST_SimpleStatement = AST_SimpleStatement;
exports.walk_body = walk_body;
exports.AST_Block = AST_Block;
exports.AST_BlockStatement = AST_BlockStatement;
exports.AST_EmptyStatement = AST_EmptyStatement;
exports.AST_StatementWithBody = AST_StatementWithBody;
exports.AST_LabeledStatement = AST_LabeledStatement;
exports.AST_IterationStatement = AST_IterationStatement;
exports.AST_DWLoop = AST_DWLoop;
exports.AST_Do = AST_Do;
exports.AST_While = AST_While;
exports.AST_For = AST_For;
exports.AST_ForIn = AST_ForIn;
exports.AST_With = AST_With;
exports.AST_Scope = AST_Scope;
exports.AST_Toplevel = AST_Toplevel;
exports.AST_Lambda = AST_Lambda;
exports.AST_Accessor = AST_Accessor;
exports.AST_Function = AST_Function;
exports.AST_Defun = AST_Defun;
exports.AST_Jump = AST_Jump;
exports.AST_Exit = AST_Exit;
exports.AST_Return = AST_Return;
exports.AST_Throw = AST_Throw;
exports.AST_LoopControl = AST_LoopControl;
exports.AST_Break = AST_Break;
exports.AST_Continue = AST_Continue;
exports.AST_If = AST_If;
exports.AST_Switch = AST_Switch;
exports.AST_SwitchBranch = AST_SwitchBranch;
exports.AST_Default = AST_Default;
exports.AST_Case = AST_Case;
exports.AST_Try = AST_Try;
exports.AST_Catch = AST_Catch;
exports.AST_Finally = AST_Finally;
exports.AST_Definitions = AST_Definitions;
exports.AST_Var = AST_Var;
exports.AST_Const = AST_Const;
exports.AST_VarDef = AST_VarDef;
exports.AST_Call = AST_Call;
exports.AST_New = AST_New;
exports.AST_Seq = AST_Seq;
exports.AST_PropAccess = AST_PropAccess;
exports.AST_Dot = AST_Dot;
exports.AST_Sub = AST_Sub;
exports.AST_Unary = AST_Unary;
exports.AST_UnaryPrefix = AST_UnaryPrefix;
exports.AST_UnaryPostfix = AST_UnaryPostfix;
exports.AST_Binary = AST_Binary;
exports.AST_Conditional = AST_Conditional;
exports.AST_Assign = AST_Assign;
exports.AST_Array = AST_Array;
exports.AST_Object = AST_Object;
exports.AST_ObjectProperty = AST_ObjectProperty;
exports.AST_ObjectKeyVal = AST_ObjectKeyVal;
exports.AST_ObjectSetter = AST_ObjectSetter;
exports.AST_ObjectGetter = AST_ObjectGetter;
exports.AST_Symbol = AST_Symbol;
exports.AST_SymbolAccessor = AST_SymbolAccessor;
exports.AST_SymbolDeclaration = AST_SymbolDeclaration;
exports.AST_SymbolVar = AST_SymbolVar;
exports.AST_SymbolConst = AST_SymbolConst;
exports.AST_SymbolFunarg = AST_SymbolFunarg;
exports.AST_SymbolDefun = AST_SymbolDefun;
exports.AST_SymbolLambda = AST_SymbolLambda;
exports.AST_SymbolCatch = AST_SymbolCatch;
exports.AST_Label = AST_Label;
exports.AST_SymbolRef = AST_SymbolRef;
exports.AST_LabelRef = AST_LabelRef;
exports.AST_This = AST_This;
exports.AST_Constant = AST_Constant;
exports.AST_String = AST_String;
exports.AST_Number = AST_Number;
exports.AST_RegExp = AST_RegExp;
exports.AST_Atom = AST_Atom;
exports.AST_Null = AST_Null;
exports.AST_NaN = AST_NaN;
exports.AST_Undefined = AST_Undefined;
exports.AST_Hole = AST_Hole;
exports.AST_Infinity = AST_Infinity;
exports.AST_Boolean = AST_Boolean;
exports.AST_False = AST_False;
exports.AST_True = AST_True;
exports.TreeWalker = TreeWalker;
exports.KEYWORDS = KEYWORDS;
exports.KEYWORDS_ATOM = KEYWORDS_ATOM;
exports.RESERVED_WORDS = RESERVED_WORDS;
exports.KEYWORDS_BEFORE_EXPRESSION = KEYWORDS_BEFORE_EXPRESSION;
exports.OPERATOR_CHARS = OPERATOR_CHARS;
exports.RE_HEX_NUMBER = RE_HEX_NUMBER;
exports.RE_OCT_NUMBER = RE_OCT_NUMBER;
exports.RE_DEC_NUMBER = RE_DEC_NUMBER;
exports.OPERATORS = OPERATORS;
exports.WHITESPACE_CHARS = WHITESPACE_CHARS;
exports.PUNC_BEFORE_EXPRESSION = PUNC_BEFORE_EXPRESSION;
exports.PUNC_CHARS = PUNC_CHARS;
exports.REGEXP_MODIFIERS = REGEXP_MODIFIERS;
exports.UNICODE = UNICODE;
exports.is_letter = is_letter;
exports.is_digit = is_digit;
exports.is_alphanumeric_char = is_alphanumeric_char;
exports.is_unicode_combining_mark = is_unicode_combining_mark;
exports.is_unicode_connector_punctuation = is_unicode_connector_punctuation;
exports.is_identifier = is_identifier;
exports.is_identifier_start = is_identifier_start;
exports.is_identifier_char = is_identifier_char;
exports.is_identifier_string = is_identifier_string;
exports.parse_js_number = parse_js_number;
exports.JS_Parse_Error = JS_Parse_Error;
exports.js_error = js_error;
exports.is_token = is_token;
exports.EX_EOF = EX_EOF;
exports.tokenizer = tokenizer;
exports.UNARY_PREFIX = UNARY_PREFIX;
exports.UNARY_POSTFIX = UNARY_POSTFIX;
exports.ASSIGNMENT = ASSIGNMENT;
exports.PRECEDENCE = PRECEDENCE;
exports.STATEMENTS_WITH_LABELS = STATEMENTS_WITH_LABELS;
exports.ATOMIC_START_TOKEN = ATOMIC_START_TOKEN;
exports.parse = parse;
exports.TreeTransformer = TreeTransformer;
exports.SymbolDef = SymbolDef;
exports.base54 = base54;
exports.OutputStream = OutputStream;
exports.Compressor = Compressor;
exports.SourceMap = SourceMap;

exports.AST_Node.warn_function = function (txt) { if (typeof console != "undefined" && typeof console.warn === "function") console.warn(txt) }

exports.minify = function (files, options) {
    options = UglifyJS.defaults(options, {
        spidermonkey : false,
        outSourceMap : null,
        sourceRoot   : null,
        inSourceMap  : null,
        fromString   : false,
        warnings     : false,
        mangle       : {},
        output       : null,
        compress     : {}
    });
    UglifyJS.base54.reset();

    // 1. parse
    var toplevel = null,
        sourcesContent = {};

    if (options.spidermonkey) {
        toplevel = UglifyJS.AST_Node.from_mozilla_ast(files);
    } else {
        if (typeof files == "string")
            files = [ files ];
        files.forEach(function(file){
            var code = options.fromString
                ? file
                : fs.readFileSync(file, "utf8");
            sourcesContent[file] = code;
            toplevel = UglifyJS.parse(code, {
                filename: options.fromString ? "?" : file,
                toplevel: toplevel
            });
        });
    }

    // 2. compress
    if (options.compress) {
        var compress = { warnings: options.warnings };
        UglifyJS.merge(compress, options.compress);
        toplevel.figure_out_scope();
        var sq = UglifyJS.Compressor(compress);
        toplevel = toplevel.transform(sq);
    }

    // 3. mangle
    if (options.mangle) {
        toplevel.figure_out_scope();
        toplevel.compute_char_frequency();
        toplevel.mangle_names(options.mangle);
    }

    // 4. output
    var inMap = options.inSourceMap;
    var output = {};
    if (typeof options.inSourceMap == "string") {
        inMap = fs.readFileSync(options.inSourceMap, "utf8");
    }
    if (options.outSourceMap) {
        output.source_map = UglifyJS.SourceMap({
            file: options.outSourceMap,
            orig: inMap,
            root: options.sourceRoot
        });
        if (options.sourceMapIncludeSources) {
            for (var file in sourcesContent) {
                if (sourcesContent.hasOwnProperty(file)) {
                    output.source_map.get().setSourceContent(file, sourcesContent[file]);
                }
            }
        }

    }
    if (options.output) {
        UglifyJS.merge(output, options.output);
    }
    var stream = UglifyJS.OutputStream(output);
    toplevel.print(stream);

    if(options.outSourceMap){
        stream += "\n//# sourceMappingURL=" + options.outSourceMap;
    }

    return {
        code : stream + "",
        map  : output.source_map + ""
    };
};

exports.describe_ast = function () {
    var out = UglifyJS.OutputStream({ beautify: true });
    function doitem(ctor) {
        out.print("AST_" + ctor.TYPE);
        var props = ctor.SELF_PROPS.filter(function(prop){
            return !/^\$/.test(prop);
        });
        if (props.length > 0) {
            out.space();
            out.with_parens(function(){
                props.forEach(function(prop, i){
                    if (i) out.space();
                    out.print(prop);
                });
            });
        }
        if (ctor.documentation) {
            out.space();
            out.print_string(ctor.documentation);
        }
        if (ctor.SUBCLASSES.length > 0) {
            out.space();
            out.with_block(function(){
                ctor.SUBCLASSES.forEach(function(ctor, i){
                    out.indent();
                    doitem(ctor);
                    out.newline();
                });
            });
        }
    };
    doitem(UglifyJS.AST_Node);
    return out + "";
};
},{"source-map":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\node_modules\\source-map\\lib\\source-map.js","util":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\browserify\\node_modules\\util\\util.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\am.css":[function(require,module,exports){
module.exports = "/* BASICS */\n\n.CodeMirror {\n  /* Set height, width, borders, and global font properties here */\n  font-family: monospace;\n  height: 300px;\n}\n\n.CodeMirror-scroll {\n  /* Set scrolling behaviour here */\n  overflow: auto;\n}\n\n/* PADDING */\n\n.CodeMirror-lines {\n  padding: 4px 0;\n  /* Vertical padding around content */\n}\n\n.CodeMirror pre {\n  padding: 0 4px;\n  /* Horizontal padding of content */\n}\n\n.CodeMirror-scrollbar-filler,\n.CodeMirror-gutter-filler {\n  background-color: white;\n  /* The little square between H and V scrollbars */\n}\n\n/* GUTTER */\n\n.CodeMirror-gutters {\n  border-right: 1px solid #ddd;\n  background-color: #f7f7f7;\n  white-space: nowrap;\n}\n\n\n\n.CodeMirror-linenumber {\n  padding: 0 3px 0 5px;\n  min-width: 20px;\n  text-align: right;\n  color: #999;\n  -moz-box-sizing: content-box;\n  box-sizing: content-box;\n}\n\n.CodeMirror-guttermarker {\n  color: black;\n}\n\n.CodeMirror-guttermarker-subtle {\n  color: #999;\n}\n\n/* CURSOR */\n\n.CodeMirror div.CodeMirror-cursor {\n  border-left: 1px solid black;\n}\n\n/* Shown when moving in bi-directional text */\n\n.CodeMirror div.CodeMirror-secondarycursor {\n  border-left: 1px solid silver;\n}\n\n.CodeMirror.cm-keymap-fat-cursor div.CodeMirror-cursor {\n  width: auto;\n  border: 0;\n  background: #7e7;\n}\n\n.cm-animate-fat-cursor {\n  width: auto;\n  border: 0;\n  -webkit-animation: blink 1.06s steps(1) infinite;\n  -moz-animation: blink 1.06s steps(1) infinite;\n  animation: blink 1.06s steps(1) infinite;\n}\n\n@-moz-keyframes blink {\n  0% {\n    background: #7e7;\n  }\n\n  50% {\n    background: none;\n  }\n\n  100% {\n    background: #7e7;\n  }\n}\n\n@-webkit-keyframes blink {\n  0% {\n    background: #7e7;\n  }\n\n  50% {\n    background: none;\n  }\n\n  100% {\n    background: #7e7;\n  }\n}\n\n@keyframes blink {\n  0% {\n    background: #7e7;\n  }\n\n  50% {\n    background: none;\n  }\n\n  100% {\n    background: #7e7;\n  }\n}\n\n/* Can style cursor different in overwrite (non-insert) mode */\n\n\n\n.cm-tab {\n  display: inline-block;\n}\n\n.CodeMirror-ruler {\n  border-left: 1px solid #ccc;\n  position: absolute;\n}\n\n/* DEFAULT THEME */\n\n.cm-s-default .cm-keyword {\n  color: #708;\n}\n\n.cm-s-default .cm-atom {\n  color: #219;\n}\n\n.cm-s-default .cm-number {\n  color: #164;\n}\n\n.cm-s-default .cm-def {\n  color: #00f;\n}\n\n\n\n.cm-s-default .cm-variable-2 {\n  color: #05a;\n}\n\n.cm-s-default .cm-variable-3 {\n  color: #085;\n}\n\n.cm-s-default .cm-comment {\n  color: #a50;\n}\n\n.cm-s-default .cm-string {\n  color: #a11;\n}\n\n.cm-s-default .cm-string-2 {\n  color: #f50;\n}\n\n.cm-s-default .cm-meta {\n  color: #555;\n}\n\n.cm-s-default .cm-qualifier {\n  color: #555;\n}\n\n.cm-s-default .cm-builtin {\n  color: #30a;\n}\n\n.cm-s-default .cm-bracket {\n  color: #997;\n}\n\n.cm-s-default .cm-tag {\n  color: #170;\n}\n\n.cm-s-default .cm-attribute {\n  color: #00c;\n}\n\n.cm-s-default .cm-header {\n  color: blue;\n}\n\n.cm-s-default .cm-quote {\n  color: #090;\n}\n\n.cm-s-default .cm-hr {\n  color: #999;\n}\n\n.cm-s-default .cm-link {\n  color: #00c;\n}\n\n.cm-negative {\n  color: #d44;\n}\n\n.cm-positive {\n  color: #292;\n}\n\n.cm-header,\n.cm-strong {\n  font-weight: bold;\n}\n\n.cm-em {\n  font-style: italic;\n}\n\n.cm-link {\n  text-decoration: underline;\n}\n\n.cm-s-default .cm-error {\n  color: #f00;\n}\n\n.cm-invalidchar {\n  color: #f00;\n}\n\n/* Default styles for common addons */\n\ndiv.CodeMirror span.CodeMirror-matchingbracket {\n  color: #0f0;\n}\n\ndiv.CodeMirror span.CodeMirror-nonmatchingbracket {\n  color: #f22;\n}\n\n.CodeMirror-matchingtag {\n  background: rgba(255, 150, 0, .3);\n}\n\n.CodeMirror-activeline-background {\n  background: #e8f2ff;\n}\n\n/* STOP */\n\n/* The rest of this file contains styles related to the mechanics of\n   the editor. You probably shouldn't touch them. */\n\n.CodeMirror {\n  line-height: 1;\n  position: relative;\n  overflow: hidden;\n  background: white;\n  color: black;\n}\n\n.CodeMirror-scroll {\n  /* 30px is the magic margin used to hide the element's real scrollbars */\n  /* See overflow: hidden in .CodeMirror */\n  margin-bottom: -30px;\n  margin-right: -30px;\n  padding-bottom: 30px;\n  height: 100%;\n  outline: none;\n  /* Prevent dragging from highlighting the element */\n  position: relative;\n  -moz-box-sizing: content-box;\n  box-sizing: content-box;\n}\n\n.CodeMirror-sizer {\n  position: relative;\n  border-right: 30px solid transparent;\n  -moz-box-sizing: content-box;\n  box-sizing: content-box;\n}\n\n/* The fake, visible scrollbars. Used to force redraw during scrolling\n   before actuall scrolling happens, thus preventing shaking and\n   flickering artifacts. */\n\n.CodeMirror-vscrollbar,\n.CodeMirror-hscrollbar,\n.CodeMirror-scrollbar-filler,\n.CodeMirror-gutter-filler {\n  position: absolute;\n  z-index: 6;\n  display: none;\n}\n\n.CodeMirror-vscrollbar {\n  right: 0;\n  top: 0;\n  overflow-x: hidden;\n  overflow-y: scroll;\n}\n\n.CodeMirror-hscrollbar {\n  bottom: 0;\n  left: 0;\n  overflow-y: hidden;\n  overflow-x: scroll;\n}\n\n.CodeMirror-scrollbar-filler {\n  right: 0;\n  bottom: 0;\n}\n\n.CodeMirror-gutter-filler {\n  left: 0;\n  bottom: 0;\n}\n\n.CodeMirror-gutters {\n  position: absolute;\n  left: 0;\n  top: 0;\n  padding-bottom: 30px;\n  z-index: 3;\n}\n\n.CodeMirror-gutter {\n  white-space: normal;\n  height: 100%;\n  -moz-box-sizing: content-box;\n  box-sizing: content-box;\n  padding-bottom: 30px;\n  margin-bottom: -32px;\n  display: inline-block;\n  /* Hack to make IE7 behave */\n  *zoom: 1;\n  *display: inline;\n}\n\n.CodeMirror-gutter-elt {\n  position: absolute;\n  cursor: default;\n  z-index: 4;\n}\n\n.CodeMirror-lines {\n  cursor: text;\n}\n\n.CodeMirror pre {\n  /* Reset some styles that the rest of the page might have set */\n  -moz-border-radius: 0;\n  -webkit-border-radius: 0;\n  border-radius: 0;\n  border-width: 0;\n  background: transparent;\n  font-family: inherit;\n  font-size: inherit;\n  margin: 0;\n  white-space: pre;\n  word-wrap: normal;\n  line-height: inherit;\n  color: inherit;\n  z-index: 2;\n  position: relative;\n  overflow: visible;\n}\n\n.CodeMirror-wrap pre {\n  word-wrap: break-word;\n  white-space: pre-wrap;\n  word-break: normal;\n}\n\n.CodeMirror-linebackground {\n  position: absolute;\n  left: 0;\n  right: 0;\n  top: 0;\n  bottom: 0;\n  z-index: 0;\n}\n\n.CodeMirror-linewidget {\n  position: relative;\n  z-index: 2;\n  overflow: auto;\n}\n\n\n\n.CodeMirror-wrap .CodeMirror-scroll {\n  overflow-x: hidden;\n}\n\n.CodeMirror-measure {\n  position: absolute;\n  width: 100%;\n  height: 0;\n  overflow: hidden;\n  visibility: hidden;\n}\n\n.CodeMirror-measure pre {\n  position: static;\n}\n\n.CodeMirror div.CodeMirror-cursor {\n  position: absolute;\n  border-right: none;\n  width: 0;\n}\n\ndiv.CodeMirror-cursors {\n  visibility: hidden;\n  position: relative;\n  z-index: 1;\n}\n\n.CodeMirror-focused div.CodeMirror-cursors {\n  visibility: visible;\n}\n\n.CodeMirror-selected {\n  background: #d9d9d9;\n}\n\n.CodeMirror-focused .CodeMirror-selected {\n  background: #d7d4f0;\n}\n\n.CodeMirror-crosshair {\n  cursor: crosshair;\n}\n\n.cm-searching {\n  background: #ffa;\n  background: rgba(255, 255, 0, .4);\n}\n\n/* IE7 hack to prevent it from returning funny offsetTops on the spans */\n\n.CodeMirror span {\n  *vertical-align: text-bottom;\n}\n\n/* Used to force a border model for a node */\n\n.cm-force-border {\n  padding-right: .1px;\n}\n\n@media print {\n  /* Hide the cursor when printing */\n\n  .CodeMirror div.CodeMirror-cursors {\n    visibility: hidden;\n  }\n}\n/**\n * Pastel On Dark theme ported from ACE editor\n * @license MIT\n * @copyright AtomicPages LLC 2014\n * @author Dennis Thompson, AtomicPages LLC\n * @version 1.1\n * @source https://github.com/atomicpages/codemirror-pastel-on-dark-theme\n */\n\n.cm-s-pastel-on-dark.CodeMirror {\n  background: #2c2827;\n  color: #8F938F;\n  line-height: 1.5;\n  font-size: 14px;\n}\n\n.cm-s-pastel-on-dark div.CodeMirror-selected {\n  background: rgba(221,240,255,0.2) !important;\n}\n\n.cm-s-pastel-on-dark .CodeMirror-gutters {\n  background: #34302f;\n  border-right: 0px;\n  padding: 0 3px;\n}\n\n.cm-s-pastel-on-dark .CodeMirror-guttermarker {\n  color: white;\n}\n\n.cm-s-pastel-on-dark .CodeMirror-guttermarker-subtle {\n  color: #8F938F;\n}\n\n.cm-s-pastel-on-dark .CodeMirror-linenumber {\n  color: #8F938F;\n}\n\n.cm-s-pastel-on-dark .CodeMirror-cursor {\n  border-left: 1px solid #A7A7A7 !important;\n}\n\n.cm-s-pastel-on-dark span.cm-comment {\n  color: #A6C6FF;\n}\n\n.cm-s-pastel-on-dark span.cm-atom {\n  color: #DE8E30;\n}\n\n.cm-s-pastel-on-dark span.cm-number {\n  color: #CCCCCC;\n}\n\n.cm-s-pastel-on-dark span.cm-property {\n  color: #8F938F;\n}\n\n.cm-s-pastel-on-dark span.cm-attribute {\n  color: #a6e22e;\n}\n\n.cm-s-pastel-on-dark span.cm-keyword {\n  color: #AEB2F8;\n}\n\n.cm-s-pastel-on-dark span.cm-string {\n  color: #66A968;\n}\n\n.cm-s-pastel-on-dark span.cm-variable {\n  color: #AEB2F8;\n}\n\n.cm-s-pastel-on-dark span.cm-variable-2 {\n  color: #BEBF55;\n}\n\n.cm-s-pastel-on-dark span.cm-variable-3 {\n  color: #DE8E30;\n}\n\n.cm-s-pastel-on-dark span.cm-def {\n  color: #757aD8;\n}\n\n.cm-s-pastel-on-dark span.cm-bracket {\n  color: #f8f8f2;\n}\n\n.cm-s-pastel-on-dark span.cm-tag {\n  color: #C1C144;\n}\n\n.cm-s-pastel-on-dark span.cm-link {\n  color: #ae81ff;\n}\n\n.cm-s-pastel-on-dark span.cm-qualifier,\n.cm-s-pastel-on-dark span.cm-builtin {\n  color: #C1C144;\n}\n\n.cm-s-pastel-on-dark span.cm-error {\n  background: #757aD8;\n  color: #f8f8f0;\n}\n\n.cm-s-pastel-on-dark .CodeMirror-activeline-background {\n  background: rgba(255, 255, 255, 0.031) !important;\n}\n\n.cm-s-pastel-on-dark .CodeMirror-matchingbracket {\n  border: 1px solid rgba(255,255,255,0.25);\n  color: #8F938F !important;\n  margin: -1px -1px 0 -1px;\n}";

},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.bezierEditor.js":[function(require,module,exports){
'use strict';

var amgui;

module.exports = function (_amgui) {

    amgui = _amgui;

    return {
        createBezierEditor: createBezierEditor,

        EASE2BEZIER: {
            'ease': 'cubic-bezier(.25,.1,.25,1)',
            'linear': 'cubic-bezier(0,0,1,1)',
            'ease-in': 'cubic-bezier(.42,0,1,1)',
            'ease-out': 'cubic-bezier(0,0,.58,1)',
            'ease-in-out': 'cubic-bezier(.42,0,.58,1)',
        },
    };
};


function createBezierEditor(opt) {

    opt = opt || {};

    var p0 = {x: 0.3, y: 0.3},
        p1 = {x: 0.7, y: 0.7},
        w = opt.width || 312,
        h = opt.height || 312;

    var de = document.createElement('div');
    de.style.position = 'relative';
    de.style.width = w + 'px';
    de.style.height = h + 'px';

    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    de.appendChild(c);

    var ctx = c.getContext('2d');
  
    var deCp0 = createCp(p0);
    var deCp1 = createCp(p1);

    de.getValue = function () {

        return 'cubic-bezier('+p0.x+','+p0.y+','+p1.x+','+p1.y+')';
    };

    de.setValue = function (points) {

        if (amgui.EASE2BEZIER.hasOwnProperty(points)) {

            points = amgui.EASE2BEZIER[points];
        }

        if (typeof(points) === 'string') {

            var rx = /cubic-bezier\(\s*([\d\.]+)\s*,\s*([\d\.-]+)\s*,\s*([\d\.]+)\s*,\s*([\d\.-]+)\s*\)/,
                m = rx.exec(points);

            if (m) {
                points = {
                    cp0x: m[1],
                    cp0y: m[2],
                    cp1x: m[3],
                    cp1y: m[4],
                };
            }
            else {
                points = {
                    cp0x: 0.3,
                    cp0y: 0.3,
                    cp1x: 0.7,
                    cp1y: 0.7,
                };
            }
        }

        p0.x = points.cp0x;
        p0.y = points.cp0y;
        p1.x = points.cp1x;
        p1.y = points.cp1y;
        
        render();
    };
    
    render();

    if (opt.onChange) {
        de.addEventListener('change', opt.onChange);
    }

    if (opt.parent) {
        opt.parent.appendChild(de);
    }
  
    return de;
  

  
  

    function render() {

        ctx.clearRect(0, 0, w, h);
        ctx.beginPath();
        ctx.moveTo(x(p0.x), y(p0.y));
        ctx.lineTo(0, y(0));
        ctx.bezierCurveTo(
            x(p0.x), y(p0.y),
            x(p1.x), y(p1.y),
            x(1), y(1));
        ctx.lineTo(x(p1.x), y(p1.y));
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.rect(x(0), y(0), x(1), y(1) - y(0));
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      
        deCp0.refreshPosition();
        deCp1.refreshPosition();
    }

    function x (p) {
        return p * w;
    }

    function y (p) {

        var min = minY(),
            max = maxY(),
            full = max - min;

        return h - (((p - min) / full) * h);
    }
  
    function minY() {
    
        return Math.min(0, p0.y, p1.y);
    }
  
    function maxY() {
    
        return Math.max(1, p0.y, p1.y);
    }

    function createCp(point) {

        var r = 6;

        var deCp = document.createElement('div');
        deCp.style.position = 'absolute';
        deCp.style.cursor = 'grab';
        deCp.style.boxSizing = 'border-box';
        deCp.style.width = r*2 + 'px';
        deCp.style.height = r*2 + 'px';
        deCp.style.transform = 'translate(-'+r+'px,-'+r+'px)';
        deCp.style.borderRadius = r + 'px';
        deCp.style.background = 'rgba(256, 256, 256, 1)';
        de.appendChild(deCp);
      
        amgui.makeDraggable({
            deTarget: deCp,
            onDown: function () {

                deCp.style.cursor = 'grabbing';

                var md = {};
                md.minY = minY();
                md.fullY = maxY() - md.minY;    
                return md;
            },
            onMove: function (md, mx, my) {

                var br = de.getBoundingClientRect();

                point.x = Math.max(0, Math.min(1, (mx - br.left) / w));
                point.y = (((br.bottom - my) / h) * md.fullY) - md.minY;
                
                var fix = 1000;
                point.x = parseInt(point.x * fix) / fix;
                point.y = parseInt(point.y * fix) / fix;

                render();
              
                de.dispatchEvent(new CustomEvent('change', {detail: {value: de.getValue()}}));
            },
            onUp: function () {

                deCp.style.cursor = 'grab';
            }
        });
      
        deCp.refreshPosition = function () {
            
            deCp.style.left = x(point.x) + 'px';
            deCp.style.top = y(point.y) + 'px';
        };
        deCp.refreshPosition();
      
        return deCp;
    }
}
},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.button.js":[function(require,module,exports){
'use strict';

var fontelloConf = require('../assets/fontello/config.json');
var amgui;

module.exports = function (_amgui) {

    amgui = _amgui;

    return {
        createIcon: createIcon,
        createLabel: createLabel,
        createBtn: createBtn,
        createIconBtn: createIconBtn,
        createToggleIconBtn: createToggleIconBtn,
        createLinebreak: createLinebreak,
    };
};


function createLinebreak(opt) {

    var de = document.createElement('br');
    de.innerHTML = opt.caption || 'label';
    
    if (opt.parent) {
        opt.parent.appendChild(de);
    }

    return de;
}

function createLabel(opt) {

    var de = document.createElement('span');
    de.innerHTML = opt.caption || 'label';

    if ('fontSize' in opt) de.style.fontSize = opt.fontSize;
    if ('display' in opt) de.style.display = opt.display;
    if ('position' in opt) de.style.position = opt.position;
    
    if (opt.parent) {
        opt.parent.appendChild(de);
    }

    return de;
}

function createBtn(opt) {

    opt.backgroundColor = opt.backgroundColor || amgui.color.bg0;

    var de = document.createElement('div');
    de.style.height = (opt.height || 21) + 'px';
    de.style.padding = '0 15px';
    de.style.cursor = 'pointer';
    de.style.color = amgui.color.text;
    de.style.backgroundColor = opt.backgroundColor;

    de.setCaption = function (caption) {

        de.textContent = caption;
    };
    
    de.setCaption(opt.caption || 'button');

    de.addEventListener('mouseenter', onMOver);
    de.addEventListener('mouseleave', onMOut);

    function onMOver() {

        this.style.background = amgui.color.bgHover;
    }

    function onMOut() {
        
        this.style.background = opt.backgroundColor;
    }

    if (opt.parent) {
        opt.parent.appendChild(de);
    }

    return de;
}

function createIconBtn(opt) {

    var isFixedHighlight = false;

    var de = amgui.createIcon({
        size: opt.height, 
        icon: opt.icon,
        parent: opt.parent,
        tooltip: opt.tooltip,
        display: opt.display,
    });
    de.style.width = (opt.width || 21) + 'px';
    de.style.cursor = 'pointer';
    de.style.color = 'white';
    de.style.overflow = 'hidden';

    de.addEventListener('mouseenter', onMOver);
    de.addEventListener('mouseleave', onMOut);

    if ('onClick' in opt) {
        de.addEventListener('click', opt.onClick);
    }

    function onMOver() {

        de.style.background = amgui.color.bgHover;
    }

    function onMOut() {
        
        if (isFixedHighlight) return;

        de.style.background = 'none';
    }

    de.fixHighlight = function () {

        isFixedHighlight = true;
        onMOver();
    };

    de.removeFixHighlight = function () {

        isFixedHighlight = false;
        onMOut();
    };

    return de;
}

function createToggleIconBtn(opt) {

    opt.iconOn = opt.iconOn || opt.icon;
    opt.iconOff = opt.iconOff || opt.icon;
    opt.color = opt.color || amgui.color.text;
    opt.colorInactive = opt.colorInactive || amgui.color.textInactive;

    var isOn = opt.defaultToggle || false;
    var de = amgui.createIconBtn(opt);
    setIcon();

    if ('autoToggle' in opt ? opt.autoToggle : !opt.onClick) {
        
        de.addEventListener('click', onClick);
    }

    if ('onToggle' in opt) {

        de.addEventListener('toggle', opt.onToggle);
    }

    de.setToggle = function (on) {

        on = !!on;
        if (on === isOn) {
            return;
        }
        
        isOn = on;
        setIcon();

        de.dispatchEvent(new CustomEvent('toggle', {detail: {state: isOn}}));
        de.dispatchEvent(new Event(isOn ? 'toggleOn' : 'toggleOff'));
    };

    de.state = function () {

        return isOn;
    };


    function onClick() {
        
        de.setToggle(!isOn);
    }

    function setIcon() {

        de.setIcon(isOn ? opt.iconOn : opt.iconOff);

        if (opt.changeColor) {
            de.style.color = isOn ? opt.color : opt.colorInactive;
        }
    }

    return de;
}

function createIcon(opt) {

    opt = opt || {};
    opt.size = opt.size || 23;
    
    var de = document.createElement('div');
    de.style.color = '#fff';
    de.style.width = opt.size + 'px';
    de.style.height = opt.size + 'px';
    de.style.lineHeight = opt.size + 'px';
    de.style.textAlign = 'center';
    de.style.fontFamily = 'amgui';
    de.style.fontSize = Math.round(opt.size * 0.72) + 'px';
    de.style.display = opt.display || 'block';

    de.setIcon = function (icon) {

        var glyph = fontelloConf.glyphs.find(function (glyph) {

            return glyph.css === icon;
        });

        var code = glyph ? glyph.code : 59407;
        de.textContent = String.fromCharCode(code);
    };

    de.setIcon(opt.icon);

    if (opt.tooltip) {
        amgui.addTooltip({
            deTarget: de,
            text: opt.tooltip
        });
    }

    if (opt.parent) {
        opt.parent.appendChild(de);
    }

    return de;
}
},{"../assets/fontello/config.json":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\assets\\fontello\\config.json"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.dialog.js":[function(require,module,exports){
'use strict';

var amgui;

module.exports = function (_amgui) {

    amgui = _amgui;

    return {
        createDialog: createDialog,
    };
};



function createDialog(opt) {

    var de, deTitle, deTitleText, deTitleIcon, titleEnd,
        contentCont, buttonsCont, buttonsEnd;

    de = document.createElement('dialog');
    (opt.parent || document.body).appendChild(de);

    de.style.background = 'none';
    de.style.border = 'none';
    de.style.pointerEvents = 'auto';
    de.style.fontFamily = amgui.FONT_FAMILY;
    de.style.color = amgui.color.text;


    deTitle = document.createElement('div');
    deTitle.style.display = 'inline-block';
    deTitle.style.padding = '0 18px';
    deTitle.style.height = '34px';
    deTitle.style.fontSize = '23px';
    deTitle.style.fontWeight = 'bold';
    deTitle.style.background = amgui.color.overlay;
    deTitle.style.color = amgui.color.text;
    de.appendChild(deTitle);

    deTitleText = document.createElement('span');
    deTitle.appendChild(deTitleText);

    if (opt.titleIcon) {

        deTitleIcon = amgui.createIcon({
            icon: opt.titleIcon,
            parent: deTitle,
            display: 'inline-block',
        });
    }

    titleEnd = document.createElement('div');
    titleEnd.style.display = 'inline-block';
    titleEnd.style.width = '0';
    titleEnd.style.height = '0';
    titleEnd.style.verticalAlign = 'bottom';
    titleEnd.style.borderStyle = 'solid';
    titleEnd.style.borderWidth = '34px 0 0 8px';
    titleEnd.style.borderColor = 'transparent transparent transparent ' + amgui.color.overlay;
    de.appendChild(titleEnd);

    

    contentCont = document.createElement('div');
    contentCont.style.background = amgui.color.overlay;
    de.appendChild(contentCont);

    buttonsCont = document.createElement('div');
    buttonsCont.style.background = amgui.color.overlay;
    buttonsCont.style.display = 'inline-block';
    buttonsCont.style.float = 'right';
    de.appendChild(buttonsCont);


    de.setTitle = function (title) {

        deTitleText.textContent = title || 'Dialog';
    };

    de.setContent = function (content) {

        if (!content) {
            return;
        }

        contentCont.innerHTML = '';
        contentCont.appendChild(content);
    };

    de.setButtons = function (buttons) {

        if (!buttons) {
            return;
        }

        buttonsCont.innerHTML = '';

        buttons.forEach(function (caption) {

            var btn = amgui.createBtn({caption: caption});
            btn.style.display = 'inline-block';
            btn.style.fontWeight = 'bold';
            btn.style.fontSize = '18px';
            btn.style.background = 'none';
            buttonsCont.appendChild(btn);

            btn.addEventListener('click', function () {
                de.dispatchEvent(new Event('click_' + caption.toLowerCase()));
            });
        });
    };

    de.setTitle(opt.title);
    de.setContent(opt.content);
    de.setButtons(opt.buttons);

    buttonsEnd = document.createElement('div');
    buttonsEnd.style.display = 'inline-block';
    buttonsEnd.style.float = 'right';
    buttonsEnd.style.width = '0';
    buttonsEnd.style.height = '0';
    buttonsEnd.style.verticalAlign = 'top';
    buttonsEnd.style.borderStyle = 'solid';
    buttonsEnd.style.borderWidth = '0 6px 21px 0';
    buttonsEnd.style.borderColor = 'transparent '+amgui.color.overlay+' transparent transparent';
    de.appendChild(buttonsEnd);

    return de;
}
},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.dropdown.js":[function(require,module,exports){
'use strict';

var amgui;

module.exports = function (_amgui) {

    amgui = _amgui;

    return {
        createDropdown: createDropdown,
        bindDropdown: bindDropdown,
    };
};



function createDropdown(opt) {

    var options = opt.options || [];

    var de = document.createElement('ul');
    de.style.listStyleType = 'none';
    de.style.margin = 0;
    de.style.padding = 0;

    options.forEach(function (opt) {

        if (typeof(opt) === 'string') {

            opt = {text: opt};
        }

        var li = document.createElement('li');
        li.textContent = opt.text;
        li.style.textAlign = 'left';
        li.style.fontFamily = amgui.FONT_FAMILY;
        li.style.fontSize = '14px';
        li.style.padding = '0 3px';
        li.style.cursor = 'pointer';
        li.style.color = amgui.color.text;
        li.style.background = amgui.color.bg2;

        li.addEventListener('click', function (e) {

            e.stopPropagation();

            if (opt.onSelect) {
                opt.onSelect();
            }

            de.dispatchEvent(new CustomEvent('select', {detail: {selection: opt.text}}));
        });
        de.appendChild(li);
    });

    if (opt.onSelect) {

        de.addEventListener('select', opt.onSelect);
    }

    return de;
}

function bindDropdown(opt) {

    var isOpened = false;
    var deBtn = opt.deTarget;
    var deDropdown = opt.deMenu;

    if (opt.asContextMenu) {

        deBtn.addEventListener('contextmenu', function (e) {

            e.stopPropagation();
            e.preventDefault();
            isOpened ? close(e) : open(e);
        });
    }
    else {
        
        deBtn.addEventListener('click', function (e) {

            e.stopPropagation();
            isOpened ? close(e) : open(e);
        });
    }

    deDropdown.style.position = 'fixed';
    deDropdown.style.pointerEvents = 'auto';
    
    deDropdown.addEventListener('select', close);

    function open(e) {

        if (isOpened) return;
        isOpened = true;

        
        amgui.placeToPoint(deDropdown, e.clientX, e.clientY, opt.side);

        var deCont = opt.menuParent || amgui.deOverlayCont || deBtn;

        deCont.appendChild(deDropdown);
        window.addEventListener('click', close);
    }

    function close() {

        if (!isOpened) return;
        isOpened = false;
        
        if (deDropdown.parentElement) {
            deDropdown.parentElement.removeChild(deDropdown);
        }
        window.removeEventListener('click', close);
    }
}
},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.input.js":[function(require,module,exports){
'use strict';

var amgui;

module.exports = function (_amgui) {

    amgui = _amgui;

    return {
        createInput: createInput,
    };
};


function createInput(opt) {

    opt = opt || {};

    var inp = document.createElement('input');
    inp.type = opt.type || 'text';
    inp.style.width = opt.width || '245px';
    inp.style.height = opt.height || '14px';
    inp.style.fontSize = opt.fontSize || '14px';
    inp.style.fontFamily = amgui.FONT_FAMILY;
    inp.style.color = amgui.color.text;
    inp.style.background = 'none';
    inp.style.border = 'none';

    if ('palceholder' in opt) inp.palceholder = opt.palceholder;
    if ('value' in opt) inp.value = opt.value;

    if (opt.parent) {
        opt.parent.appendChild(inp);
    }

    return inp;
}
},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;

WebFont.load({
    google: {
      families: ['Open Sans']
    }
});

var amgui = new EventEmitter();

_.extend(amgui,
    require('./amgui.bezierEditor')(amgui),
    require('./amgui.button')(amgui),
    require('./amgui.dialog')(amgui),
    require('./amgui.dropdown')(amgui),
    require('./amgui.input')(amgui),
    require('./amgui.keys')(amgui),
    require('./amgui.keyValueInput')(amgui),
    require('./amgui.makeDraggable')(amgui),
    require('./amgui.scroll')(amgui),
    require('./amgui.tooltip')(amgui),
    require('./amgui.utils')(amgui),
    {

        FONT_FAMILY: '"Open Sans", sans-serif',
        FONT_SIZE: '15px',

        color: {
            bg0: '#000',
            bg1: '#222',
            bg2: '#444',
            bg3: '#666',
            text: '#efe',
            textInactive: 'rgba(255,255,255,.23)',
            overlay: 'rgba(0,0,0,.785)',
            bgHover: 'rgba(255,255,255,0.12)',
        },

        getStyleSheet: function () {

            var style = document.createElement('style');

            style.innerHTML = 'dialog::backdrop { background:'+amgui.color.bgHover+' }';

            return style;
        }
    }
);


amgui.setMaxListeners(0);

module.exports = amgui;
},{"./amgui.bezierEditor":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.bezierEditor.js","./amgui.button":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.button.js","./amgui.dialog":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.dialog.js","./amgui.dropdown":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.dropdown.js","./amgui.input":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.input.js","./amgui.keyValueInput":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.keyValueInput.js","./amgui.keys":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.keys.js","./amgui.makeDraggable":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.makeDraggable.js","./amgui.scroll":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.scroll.js","./amgui.tooltip":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.tooltip.js","./amgui.utils":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.utils.js","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.keyValueInput.js":[function(require,module,exports){
'use strict';

var amgui;

module.exports = function (_amgui) {

    amgui = _amgui;

    return {
        createKeyValueInput: createKeyValueInput,
    };
};



function createKeyValueInput(opt) {

        opt = opt || {};

        var de = document.createElement('div');
        de.style.margin = '0 1px';

        var keyOn = false;

        var oldKey, oldValue;

        var inpKey = createInput('parameter name');
        inpKey.addEventListener('keypress', onKeyPress);

        var divider = createDivider();

        var inpValue = createInput('value');
        // inpValue.style.color = 'lightblue';
        inpValue.style.textAlign = 'right';
        inpValue.style.right = '0px';

        showHideValue(keyOn);

        de.getKey = function () {
            return inpKey.value;
        };

        de.setKey = function (v) {
            
            if (v === oldKey) return;
            
            oldKey = v;
            inpKey.value = v;
            checkKeyOn();
        };

        de.getValue = function () {
            return inpValue.value;
        };

        de.setValue = function (v) {
            
            if (v === oldValue) return;

            oldValue = v;
            inpValue.value = v;
        };

        if (opt.parent) {
            opt.parent.appendChild(de);
        }

        if (opt.key) {
            de.setKey(opt.key);
        }

        if (opt.value) {
            de.setValue(opt.value);
        }

        if (opt.onChange) {
            de.addEventListener('change', opt.onChange);
        }

        function onChange(e) {

            e.preventDefault();
            e.stopPropagation();
            
            checkKeyOn();

            var detail = {};
            
            if (de.getKey() !== oldKey) {
                oldKey = detail.key = de.getKey();
            }
            if (de.getValue() !== oldValue) {
                oldValue = detail.value = de.getValue();
            }

            if ('value' in detail || 'key' in detail) {

                de.dispatchEvent(new CustomEvent('change', {detail: detail}));
            }
        }

        function onKeyPress(e) {
            
            if (e.keyCode === 13) {
                
                e.preventDefault();
                e.stopPropagation();

                inpValue.focus();
            }
        }

        function checkKeyOn() {

            var on = !!inpKey.value;

            if (on !== keyOn) {
                
                keyOn = on;
                showHideValue(keyOn);
            }
        }

        function showHideValue(show) {
            
            divider.style.display = show ? 'inline' : 'none';
            inpValue.style.display = show ? 'inline-block' : 'none';
            inpKey.style.width = show ? 'calc(50% - 5px)' : '100%';
        }

        function createInput(placeholder) {

            var inp = document.createElement('input');
            inp.type = 'text';
            inp.placeholder = placeholder;
            inp.style.width = '50%';
            inp.style.height = '100%';
            inp.style.fontSize = amgui.FONT_SIZE;
            inp.style.fontFamily = amgui.FONT_FAMILY;
            inp.style.background = 'none';
            inp.style.border = 'none';
            inp.style.color = amgui.color.text;
            inp.addEventListener('change', onChange);
            inp.addEventListener('keyup', onChange);
            // $(inp).autosizeInput({space: 0});
            de.appendChild(inp);
            return inp;
        }

        function createDivider () {

            var divider = document.createElement('span');
            divider.textContent = ':';
            divider.style.color = amgui.color.text;
            divider.style.width = '2px';
            divider.style.fontSize = amgui.FONT_SIZE;
            divider.style.fontFamily = amgui.FONT_FAMILY;
            de.appendChild(divider);

            return divider;
        }

        return de;
    }
},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.keys.js":[function(require,module,exports){
'use strict';

var amgui;

module.exports = function (_amgui) {

    amgui = _amgui;

    return {
        createKeyline: createKeyline,
        createKey: createKey
    };
};


function createKeyline(opt) {

    var deKeys = [];

    var de = document.createElement('div');
    de.style.width = '100%';
    de.style.height = (opt.height || 21) + 'px';
    de.style.background = opt.background || 'grey';
    de.style.position = 'relative';

    var svgEase = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEase.style.width = '100%';
    svgEase.style.height = '100%';
    svgEase.style.fill = 'none';
    svgEase.style.stroke = 'white';
    svgEase.style.position = 'absolute';
    de.appendChild(svgEase);

    amgui.callOnAdded(de, renderEase);

    de.addKey = function (opt) {

        var deKey = amgui.createKey(opt);
        deKeys.push(deKey);

        de.appendChild(deKey);

        deKey.addEventListener('change', renderEase);
        deKey.addEventListener('remove', onKeyRemove);
        renderEase();

        return deKey;
    };

    function sortKeys() {

        deKeys.sort(function (a, b) {
        
            return a.offsetLeft - b.offsetLeft;
        });
    }

    function onKeyRemove () {

        var deKey = this,
            idx = deKeys.indexOf(deKey);

        if (idx === -1) {
            return;
        }

        deKeys.splice(idx, 1);
        
        deKey.removeEventListener('change', renderEase);
        deKey.removeEventListener('remove', onKeyRemove);

        if (deKey.parentNode) {
            deKey.parentNode.removeChild(deKey);
        }

        renderEase();
    }

    function renderEase() {

        sortKeys();

        svgEase.innerHTML = '';

        deKeys.forEach(function (deKey, idx) {

            if (idx === deKeys.length-1) {
                return;
            }

            var ease = deKey.ease;

            if (amgui.EASE2BEZIER.hasOwnProperty(ease)) {
                ease = amgui.EASE2BEZIER[ease];
            }

            var rx = /cubic-bezier\(\s*([\d\.]+)\s*,\s*([\d\.-]+)\s*,\s*([\d\.]+)\s*,\s*([\d\.-]+)\s*\)/,
                m = rx.exec(ease),
                x = deKey.offsetLeft,
                w = deKeys[idx+1].offsetLeft - x,
                h = de.offsetHeight,
                path = document.createElementNS('http://www.w3.org/2000/svg', 'path'),
                d = '';

            if (m) {
                d += 'M' + x + ',' + h + ' ';
                d += 'C' + (x + w*m[1]) + ',' + (h - h*m[2]) + ' ';
                d += (x + w*m[3]) + ',' + (h - h*m[4]) + ' ';
                d += (x + w) + ',' + 0;
            }
            else {
                return;
                //TODO steps()
                // d += 'M' + x + ',' + h + ' ';
                // d += 'L' + (x + w) + ',0';
            }

            path.setAttribute('d', d);
            svgEase.appendChild(path);
        });
    }

    return de;
}

function createKey(opt) {

    opt = opt || {};

    opt.color = opt.color || '#7700ff';

    var isUserSelected = false,
        time = opt.time || 0, 
        timescale = opt.timescale || 1;

    var de = document.createElement('div');
    de.style.position = 'absolute';
    de.style.transform = 'translateX(-4px)';

    var key = document.createElement('div');
    key.style.width = '0';
    key.style.height = '0';
    key.style.borderStyle = 'solid';
    key.style.borderWidth = '21px 4px 0 4px';
    key.style.borderColor = opt.color + ' transparent transparent transparent';
    de.appendChild(key);

    amgui.makeDraggable({
        deTarget: de,
        onDown: function (e) {

            if (!e.shiftKey && !e.ctrlKey) {
                amgui.emit('deselectAllKeys');
            }

            if (e.ctrlKey) {
                toggleUserSelected();
            }
            else {
                userSelect(true);
            }
            
            return {
                dragged: 0,
            };
        },
        onMove: function (md, mx) {

            var diff = mx - md.mx,
                diffTime = (diff / timescale) - md.dragged;
                
            md.dragged += diffTime;

            amgui.emit('translateSelectedKeys', diffTime);
        }
    });

    amgui.on('deselectAllKeys', onDeselectAllKeys);
    amgui.on('translateSelectedKeys', onTranslateSelectedKeys);

    de.setTime = function(t) {

        if (time === t) return;

        time = t;
        setLeft();
        de.dispatchEvent(new Event('change'));

        de.dispatchEvent(new CustomEvent('changeTime', {detail: {time: time}}));
    };
    de.setTimescale = function(ts) {

        if (timescale === ts) return;

        timescale = ts;
        setLeft();
        de.dispatchEvent(new Event('change'));
    };

    de.setEase = function(ease) {

        if (de.ease === ease) {
            return;
        }   

        de.ease = ease;

        de.dispatchEvent(new Event('change'));
    };

    de.remove = function() {

        amgui.removeListener('deselectAllKeys', onDeselectAllKeys);
        amgui.removeListener('translateSelectedKeys', onTranslateSelectedKeys);

        de.dispatchEvent(new Event('remove'));
    };

    setLeft();
    de.setEase(opt.ease);

    return de;

    ///////////////////////////////////////////////////////


    function setLeft() {

        de.style.left = (time * timescale) + 'px';
    }

    function toggleUserSelected() {

        userSelect(!isUserSelected);
    }

    function userSelect(on) {

        isUserSelected = on;
        de.style.background = isUserSelected ? 'white' : 'none';
    }

    function onDeselectAllKeys() {

        userSelect(false);
    }

    function onTranslateSelectedKeys(offset) {

        if (isUserSelected) {

            de.setTime(time + offset);
        }
    }
}
},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.makeDraggable.js":[function(require,module,exports){
'use strict';

var amgui;

module.exports = function (_amgui) {

    amgui = _amgui;

    return {
        makeDraggable: makeDraggable,
    };
};

function makeDraggable(opt) {

    opt = opt || {};

    var md;

    opt.deTarget.addEventListener('mousedown', onDown);
    opt.deTarget.addEventListener('mouseenter', onEnter);
    opt.deTarget.addEventListener('mouseleave', onLeave);

    function onDown(e) {

        if (e.button !== 0) {
            
            return;
        }

        e.stopPropagation();
        e.preventDefault();

        md = call('onDown', [e]) || {};

        md.mx = e.clientX;
        md.my = e.clientY;

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('mouseleave', onUp);
    }

    function onMove(e) {

        call('onMove', [md, e.clientX, e.clientY, e]);
    }

    function onUp() {

        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('mouseleave', onUp);

        call('onUp');
    }

    function onEnter() {

        call('onEnter');
    }

    function onLeave() {
        
        call('onLeave');
    }

    function call(name, args) {

        if (name in opt) {

            return opt[name].apply(opt.thisArg, args);
        }
    }
}
},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.scroll.js":[function(require,module,exports){
'use strict';

var amgui;

module.exports = function (_amgui) {

    amgui = _amgui;

    return {
        createRange: createRange,
        makeScrollable: makeScrollable,
    };
};



function makeScrollable(opt) {

    var pos = 0,
        deConts = opt.deCont,
        deTargets = opt.deTarget,
        deRange = opt.deRange,
        ret = {dispose: dispose};

    if (!Array.isArray(deConts)) deConts = [deConts];
    if (!Array.isArray(deTargets)) deTargets = [deTargets];

    deConts.forEach(function (deC) {

        deC.addEventListener('wheel', onWheel);
    });

    if (deRange) {
        initRange();
    }

    return ret;

    function onWheel(e) {

        var way = e.deltaY/3,
            maxH = getTargetMaxH();
        
        pos = Math.max(0, Math.min(maxH, pos + way));

        if (deRange) {

            deRange.setValue(pos / maxH);
        }

        scroll();

    }

    function onChangeRange(e) {

        pos = getTargetMaxH() * e.detail.value;
        scroll();
    }

    function scroll() {

        deTargets.forEach(function (deT) {

            deT.style.top = -pos + 'px';
        });
    }

    function getTargetMaxH() {

        var contH = Math.max.apply(null, deConts.slice().map(getH)),
            targetH = Math.max.apply(null, deTargets.slice().map(getH));

        return targetH - contH;
    }

    function getH(de) {

        return de.getBoundingClientRect().height;
    }

    function initRange() {

        var saveDisplay = deRange.style.display,
            isShowing = false,
            refreshSetI;

        deRange.style.display = 'none';

        deRange.addEventListener('change', onChangeRange);

        refreshSetI = setInterval(function () {

            var needsRange = getTargetMaxH() > 0;

            if (isShowing !== needsRange) {

                isShowing = needsRange;

                deRange.style.display = isShowing ? saveDisplay : 'none';
            }
        }, 312); 

        var saveDispose = ret.dispose;
        ret.dispose = function dispose () {

            saveDispose();

            clearInterval(refreshSetI);

            deRange.removeEventListener('change', onChangeRange);
        };
    }

    function dispose() {

        deConts.forEach(function (deC) {

            deC.removeEventListener('wheel', onWheel);
        });
    }
}




function createRange(opt) {

    opt = opt || {};
  
    var value = 0, cursorWidth = 0, isVertical = !!opt.vertical;

    var de = document.createElement('div');
    de.style.position = 'relative';
    de.style.width = opt.width || '12px';
    de.style.height = opt.height || '140px';
    de.style.background = amgui.color.bg1;
    de.style.cursor = 'pointer';

    var deCursor = document.createElement('div');
    deCursor.style.position = 'absolute';
    deCursor.style[d('left','top')] = '0';
    deCursor.style[d('right','bottom')] = '0';
    deCursor.style.margin = d('auto 0','0 auto');
    deCursor.style.background = amgui.color.bg3;
    deCursor.style[d('width','height')] = opt.cursorHeight || '100%';
    de.appendChild(deCursor);

    if (opt.parent) {
        opt.parent.appendChild(de);
    }

    de.setCursorWidth = function (w) {

        deCursor.style[d('height','width')] = w + 'px';
        cursorWidth = w;
    };
    de.setCursorWidth(opt.cursorWidth || 12);   

    amgui.makeDraggable({
        deTarget: de,
        onMove: function (md, mx, my) {

            var br = de.getBoundingClientRect(),
                p = d(my, mx) - (d(br.top, br.left) + cursorWidth/2),
                fw = d(br.height, br.width) - cursorWidth,
                pos = Math.max(0, Math.min(1, p / fw));

            de.setValue(pos);
        }
    });

    de.setValue = function (v) {

        if (v === value) return;

        value = v;
        
        var width = de.getBoundingClientRect()[d('height','width')];
        deCursor.style[d('top','left')] = ((width - cursorWidth) * value) + 'px';

        de.dispatchEvent(new CustomEvent('change', {detail: {value: value}}));
    };

    de.getValue = function () {

        return value;
    };

    function d (vertical, horisontal) {

        return isVertical ? vertical : horisontal;
    }

    return de;
}
},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.tooltip.js":[function(require,module,exports){
'use strict';

var amgui;

module.exports = function (_amgui) {

    amgui = _amgui;

    return {
        addTooltip: addTooltip,
    };
};



function addTooltip(opt) {

    var showSetT, delay = 423, mx = 0, my = 0;

    var de = document.createElement('div');
    de.textContent = opt.text;
    de.style.position = 'fixed';
    de.style.padding = '12px';
    de.style.display = 'inline-block';
    de.style.background = amgui.color.overlay;
    de.style.color = amgui.color.text;

    opt.deTarget.addEventListener('mouseenter', onMEnter);

    function onMEnter(e) {

        opt.deTarget.addEventListener('mousemove', onMMove);
        opt.deTarget.addEventListener('mouseleave', onMLeave);
        opt.deTarget.addEventListener('mousedown', onMLeave);

        onMMove(e);
    }

    function onMLeave() {

        opt.deTarget.removeEventListener('mousemove', onMMove);
        opt.deTarget.removeEventListener('mouseleave', onMLeave);
        opt.deTarget.removeEventListener('mousedown', onMLeave);

        hide();
        clearShowSetT();
    }

    function onMMove(e) {

        hide();
        refreshShowSetT();
        mx = e.clientX;
        my = e.clientY;
    }

    function refreshShowSetT() {

        clearShowSetT();
        showSetT = setTimeout(show, delay);
    }

    function clearShowSetT() {

        clearTimeout(showSetT);
    }

    function show() {

        amgui.deOverlayCont.appendChild(de);
        amgui.placeToPoint(de, mx, my, opt.side);
    }

    function hide() {

        if (de.parentElement) {
            de.parentElement.removeChild(de);
        }
    }
}
},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.utils.js":[function(require,module,exports){
'use strict';

var amgui;

module.exports = function (_amgui) {

    amgui = _amgui;

    return {
        placeToPoint: placeToPoint,
        callOnAdded: callOnAdded,
    };
};


function placeToPoint(de, mx, my, way) {

    var px = 0, py = 0,
        br = de.getBoundingClientRect(),
        w = br.width,
        h = br.height,
        ww = window.innerWidth,
        wh = window.innerHeight;

    way = way || 'left';

    switch (way) {

        case 'top':
            px = mx - (w / 2);
            py = my - h;
            break;

        case 'right':
            px = mx;
            py = my - (h / 2);
            break;

        case 'bottom':
            px = mx - (w / 2);
            py = my;
            break;

        default:
        case 'left':
            px = mx - w;
            py = my - (h / 2);
    }

    if (py < 0) py = 0;
    if (px + w > ww) px -= (px + w) - ww;
    if (py + h > wh) py -= (py + h) - wh;
    if (px < 0) px = 0;

    de.style.left = px + 'px';
    de.style.top = py + 'px';
}

function callOnAdded(de, cb, thisArg) {

    var setI = setInterval(function () {

        if (check(de)) {

            clearInterval(setI);

            cb.call(thisArg);
        }
        
    }, 234);
    
    function check (node) {

        while (node.parentNode) {

            node = node.parentNode;
            
            if (node.nodeType === 9 || node.nodeType === 11) {

                return true;
            }
        }
    }
}
},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\assets\\fontello\\config.json":[function(require,module,exports){
module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports={
  "name": "amgui",
  "css_prefix_text": "icon-",
  "css_use_suffix": false,
  "hinting": true,
  "units_per_em": 1000,
  "ascent": 850,
  "glyphs": [
    {
      "uid": "53ed8570225581269cd7eff5795e8bea",
      "css": "emo-unhappy",
      "code": 59412,
      "src": "fontelico"
    },
    {
      "uid": "68e298ff2d8b25dd7f647ed64f5ae690",
      "css": "emo-surprised",
      "code": 59432,
      "src": "fontelico"
    },
    {
      "uid": "8ce732688587909ad0a9d8323eaca8ad",
      "css": "marquee",
      "code": 59413,
      "src": "fontelico"
    },
    {
      "uid": "5211af474d3a9848f67f945e2ccaf143",
      "css": "cancel",
      "code": 59427,
      "src": "fontawesome"
    },
    {
      "uid": "44e04715aecbca7f266a17d5a7863c68",
      "css": "plus",
      "code": 59431,
      "src": "fontawesome"
    },
    {
      "uid": "1a5cfa186647e8c929c2b17b9fc4dac1",
      "css": "plus-squared",
      "code": 59398,
      "src": "fontawesome"
    },
    {
      "uid": "c5fd349cbd3d23e4ade333789c29c729",
      "css": "eye",
      "code": 59438,
      "src": "fontawesome"
    },
    {
      "uid": "7fd683b2c518ceb9e5fa6757f2276faa",
      "css": "eye-off",
      "code": 59439,
      "src": "fontawesome"
    },
    {
      "uid": "9a76bc135eac17d2c8b8ad4a5774fc87",
      "css": "download",
      "code": 59414,
      "src": "fontawesome"
    },
    {
      "uid": "f5999a012fc3752386635ec02a858447",
      "css": "download-cloud",
      "code": 115,
      "src": "fontawesome"
    },
    {
      "uid": "de2fc7a5c986ab8c622f63455d7cf814",
      "css": "upload-cloud",
      "code": 117,
      "src": "fontawesome"
    },
    {
      "uid": "7034e4d22866af82bef811f52fb1ba46",
      "css": "code",
      "code": 59417,
      "src": "fontawesome"
    },
    {
      "uid": "f48ae54adfb27d8ada53d0fd9e34ee10",
      "css": "trash",
      "code": 59396,
      "src": "fontawesome"
    },
    {
      "uid": "1b5a5d7b7e3c71437f5a26befdd045ed",
      "css": "doc",
      "code": 59405,
      "src": "fontawesome"
    },
    {
      "uid": "26613a2e6bc41593c54bead46f8c8ee3",
      "css": "file-code",
      "code": 59400,
      "src": "fontawesome"
    },
    {
      "uid": "b091a8bd0fdade174951f17d936f51e4",
      "css": "folder-empty",
      "code": 59403,
      "src": "fontawesome"
    },
    {
      "uid": "6533bdc16ab201eb3f3b27ce989cab33",
      "css": "folder-open-empty",
      "code": 59404,
      "src": "fontawesome"
    },
    {
      "uid": "559647a6f430b3aeadbecd67194451dd",
      "css": "menu",
      "code": 59440,
      "src": "fontawesome"
    },
    {
      "uid": "e99461abfef3923546da8d745372c995",
      "css": "cog",
      "code": 59393,
      "src": "fontawesome"
    },
    {
      "uid": "5bb103cd29de77e0e06a52638527b575",
      "css": "wrench",
      "code": 59415,
      "src": "fontawesome"
    },
    {
      "uid": "21b42d3c3e6be44c3cc3d73042faa216",
      "css": "sliders",
      "code": 59416,
      "src": "fontawesome"
    },
    {
      "uid": "e594fc6e5870b4ab7e49f52571d52577",
      "css": "resize-full",
      "code": 59437,
      "src": "fontawesome"
    },
    {
      "uid": "3c24ee33c9487bbf18796ca6dffa1905",
      "css": "resize-small",
      "code": 59436,
      "src": "fontawesome"
    },
    {
      "uid": "c53068fe21c8410b0a098b4c52c3d37e",
      "css": "down-circled2",
      "code": 59433,
      "src": "fontawesome"
    },
    {
      "uid": "f3f90c8c89795da30f7444634476ea4f",
      "css": "angle-left",
      "code": 59434,
      "src": "fontawesome"
    },
    {
      "uid": "7bf14281af5633a597f85b061ef1cfb9",
      "css": "angle-right",
      "code": 59394,
      "src": "fontawesome"
    },
    {
      "uid": "5de9370846a26947e03f63142a3f1c07",
      "css": "angle-up",
      "code": 59435,
      "src": "fontawesome"
    },
    {
      "uid": "e4dde1992f787163e2e2b534b8c8067d",
      "css": "angle-down",
      "code": 59395,
      "src": "fontawesome"
    },
    {
      "uid": "bc71f4c6e53394d5ba46b063040014f1",
      "css": "cw",
      "code": 59425,
      "src": "fontawesome"
    },
    {
      "uid": "f9c3205df26e7778abac86183aefdc99",
      "css": "ccw",
      "code": 59426,
      "src": "fontawesome"
    },
    {
      "uid": "d4816c0845aa43767213d45574b3b145",
      "css": "history",
      "code": 59418,
      "src": "fontawesome"
    },
    {
      "uid": "ce06b5805120d0c2f8d60cd3f1a4fdb5",
      "css": "play",
      "code": 59397,
      "src": "fontawesome"
    },
    {
      "uid": "0b28050bac9d3facf2f0226db643ece0",
      "css": "pause",
      "code": 59399,
      "src": "fontawesome"
    },
    {
      "uid": "8772331a9fec983cdb5d72902a6f9e0e",
      "css": "scissors",
      "code": 59424,
      "src": "fontawesome"
    },
    {
      "uid": "130380e481a7defc690dfb24123a1f0c",
      "css": "circle",
      "code": 59442,
      "src": "fontawesome"
    },
    {
      "uid": "422e07e5afb80258a9c4ed1706498f8a",
      "css": "circle-empty",
      "code": 59441,
      "src": "fontawesome"
    },
    {
      "uid": "266d5d9adf15a61800477a5acf9a4462",
      "css": "chart-bar",
      "code": 59419,
      "src": "fontawesome"
    },
    {
      "uid": "f4445feb55521283572ee88bc304f928",
      "css": "floppy",
      "code": 59401,
      "src": "fontawesome"
    },
    {
      "uid": "3e674995cacc2b09692c096ea7eb6165",
      "css": "megaphone",
      "code": 59430,
      "src": "fontawesome"
    },
    {
      "uid": "795efd07cd5205b589c883916a76cff0",
      "css": "hdd",
      "code": 59411,
      "src": "fontawesome"
    },
    {
      "uid": "fa10777b2d88cc64cd6e4f26ef0e5264",
      "css": "terminal",
      "code": 59429,
      "src": "fontawesome"
    },
    {
      "uid": "c92ad3028acce9d51bae0ac82f5de8a2",
      "css": "bullseye",
      "code": 59408,
      "src": "fontawesome"
    },
    {
      "uid": "55605ca79a65def1a9c300037ff1d0d5",
      "css": "paw",
      "code": 59420,
      "src": "fontawesome"
    },
    {
      "uid": "fbede3c5584282a0e9b131926dff71da",
      "css": "cube",
      "code": 59428,
      "src": "fontawesome"
    },
    {
      "uid": "c53415fbd2695033bd7180d7a9ed4934",
      "css": "rebel",
      "code": 59421,
      "src": "fontawesome"
    },
    {
      "uid": "6632ce1019f9115842335622cb55f4e7",
      "css": "empire",
      "code": 59422,
      "src": "fontawesome"
    },
    {
      "uid": "9e34a047fee949eae9b6e613d790d6cf",
      "css": "dropbox",
      "code": 59409,
      "src": "fontawesome"
    },
    {
      "uid": "e7cb72a17f3b21e3576f35c3f0a7639b",
      "css": "git",
      "code": 59406,
      "src": "fontawesome"
    },
    {
      "uid": "2c2ca8a96b31781c9c8056d05c0a8980",
      "css": "blank",
      "code": 59407,
      "src": "fontawesome"
    },
    {
      "uid": "9c7fd7637a41b59a358cb70893f945a5",
      "css": "rocket",
      "code": 59423,
      "src": "entypo"
    },
    {
      "uid": "e536c80e011366046360f5ffe669dbfd",
      "css": "folder-add",
      "code": 59402,
      "src": "typicons"
    },
    {
      "uid": "366510ecfb08cd0110134b1ea907fb81",
      "css": "evernote",
      "code": 59410,
      "src": "zocial"
    },
    {
      "uid": "272e08e0e16226aadf94dcbf33aab2b2",
      "css": "key",
      "code": 59392,
      "src": "elusive"
    }
  ]
}
},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\chronicler\\Chronicler.js":[function(require,module,exports){
'use strict';

function Chronicler() {

    this._stack = [], 
    this._pointer = -1;
    this._chains = [];
    this._flagCounter = 0;
}

var p = Chronicler.prototype;

p.undo = function () {

    if (this._pointer > -1) {

        call(this._stack[this._pointer--].undo);
    }
};

p.redo = function () {

    if (this._pointer < this._stack.length - 1) {

        call(this._stack[++this._pointer].redo);
    }
};

p.undo = function() {

    if (this._pointer < 0) {

        return false;
    }

    var rec = this._stack[this._pointer--];

    if (typeof(rec) === 'number') {

        var startFlagIdx = this._stack.indexOf(rec - 1);

        if (startFlagIdx !== -1) {

            while (this._pointer !== startFlagIdx) {

                call(this._stack[this._pointer--].undo);
            }

            this._pointer--;
        }
    }
    else {
        call(rec.undo);
    }
};

p.redo = function() {

    if (this._pointer >= this._stack.length - 1) {

        return false;
    }

    var rec = this._stack[++this._pointer];
    
    if (typeof(rec) === 'number') {

        var endFlagIdx = this._stack.indexOf(rec + 1);

        if (endFlagIdx !== -1) {

            while (++this._pointer !== endFlagIdx) {

                call(this._stack[this._pointer].redo);
            }
        }
    }
    else {
        call(rec.redo);
    }
};

function call(reg) {

    if (typeof reg === 'function') {

        reg();
    }
    else {
        reg[0].apply(reg[1], reg.slice(2));
    }
}

p.save = function (undo, redo) {

    var reg = {undo: undo, redo: redo};

    this._saveReg(reg);

    return reg;
};


p._saveReg = function (reg) {

    this._stack.splice(++this._pointer, this._stack.length, reg);
};








p.startFlag = function () {

    this._saveReg(this._flagCounter++);
    return this._flagCounter++;
};

p.endFlag = function (flag) {

    this._saveReg(flag);
};

p.wrap = function (fn, ctx) {

    return function () {

        var endFlag = this.startFlag();

        fn.apply(ctx, Array.prototype.slice.call(arguments,  2));

        this.endFlag(endFlag);
    }.bind(this);
};








p.saveChain = function (id, undo, redo, delay) {

    var chain = this.getChain(id);

    if (chain) {
        
        chain.reg.redo = redo;
    }
    else {

        chain = {
            id: id,
            reg: this.save(undo, redo)
        };
        this._chains.push(chain);
    }

    if (delay === undefined) {
        delay = 312;
    }

    clearTimeout(chain.tid);
    chain.tid = setTimeout(this.closeChain.bind(this, id), delay);
};

p.closeChain = function (id) {

    var chain = this.getChain(id);

    if (!chain) {
        return;
    }

    clearTimeout(chain.tid);
    this._chains.splice(this._chains.indexOf(chain), 1);
};

p.clear = function () {

    while (this._chains.length) {
        this.closeChain(this._chains[0].id);
    }
    
    this._stack.length = 0, 
    this._pointer = -1;
};

p.getChain = function (id) {

    return this._chains.find(function (chain) {

        return chain.id === id;
    });
};

module.exports = Chronicler;
},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\commonDialogs\\dialogFeatureDoesntExits.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var amgui = require('../amgui');

function DialogFeatureDoesntExits () {

    EventEmitter.call(this);

    this._name = '';
    this._selectors = [];

    this._onClickOk = this._onClickOk.bind(this); 
}

inherits(DialogFeatureDoesntExits, EventEmitter);
var p = DialogFeatureDoesntExits.prototype;

p.show = function (opt) {

    opt = opt || {};

    this._createDialog();

    this.domElem.showModal();
};

p.hide = function () {

    this.domElem.close();
};

p._createDialog = function () {

    if (this._isDialogCreated) return;
    this._isDialogCreated = true;

    this._createContent();
    
    this.domElem = amgui.createDialog({
        titleIcon: 'emo-unhappy',
        title: 'Sorry',
        content: this._deContent,
        parent: am.deDialogCont,
        buttons: ['ok'],
    });

    this.domElem.addEventListener('click_ok', this._onClickOk);
};

p._onClickOk = function () {

    this.hide();
};


p._createContent = function () {

    this._deContent = document.createElement('div');
    this._deContent.style.width = '330px';
    this._deContent.style.padding = '30px 12px';

    amgui.createLabel({
        caption: 'This feature doesn\'t exits yet. (But it\'s on the way!)',
        fontSize: '18px',
        display: 'block',
        parent: this._deContent
    });
};

module.exports = new DialogFeatureDoesntExits();

},{"../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\commonDialogs\\dialogFeedback.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var amgui = require('../amgui');

function DialogFeedback () {

    EventEmitter.call(this);

    this._name = '';
    this._selectors = [];

    this._onClickOk = this._onClickOk.bind(this); 
}

inherits(DialogFeedback, EventEmitter);
var p = DialogFeedback.prototype;

p.show = function (opt) {

    opt = opt || {};

    this._createDialog();

    this.domElem.showModal();
};

p.hide = function () {

    this.domElem.close();
};

p._createDialog = function () {

    if (this._isDialogCreated) return;
    this._isDialogCreated = true;

    this._createContent();
    
    this.domElem = amgui.createDialog({
        title: 'Feedback',
        content: this._deContent,
        parent: am.deDialogCont,
        buttons: ['ok'],
    });

    this.domElem.addEventListener('click_ok', this._onClickOk);
};

p._onClickOk = function () {

    this.hide();
};


p._createContent = function () {

    this._deContent = document.createElement('div');
    this._deContent.style.width = '450px';
    this._deContent.style.padding = '30px 12px';

    amgui.createLabel({
        caption: 'Hi! This program is in alpha state, so most of the things will change and most of the bugs are known. But if you have any question, feedback, feature request, bug report or just feel the need for contact, you can use the azazdeaz@gmail.com or the <a style="color:white;" href="https://github.com/animachine/animachine/issues">github issues</a>.',
        fontSize: '18px',
        display: 'block',
        parent: this._deContent
    });
};

module.exports = new DialogFeedback();

},{"../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\dom-picker\\DomPicker.js":[function(require,module,exports){
"use strict";

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var amgui = require('../amgui');

function DomPicker() {

    EventEmitter.call(this);

    this._isMouseOver = false;
    this._crumbs = [];

    this._onMMove = this._onMMove.bind(this);
    this._render = this._render.bind(this);
    window.addEventListener('mousemove', this._onMMove);

    this._createBase();
}

inherits(DomPicker, EventEmitter);
var p = DomPicker.prototype;

module.exports = DomPicker;

p.focusElem = function (target) {

    var oldTarget = this._deTarget,
        crumbs = this._crumbs,
        lastCrumb = crumbs[crumbs.length-1];

    if (oldTarget && oldTarget.parentElement === target) {

        crumbs.push(oldTarget);
    }
    else if (target === lastCrumb) {
        
        crumbs.pop();
    }
    else if (target.parentElement === lastCrumb) {

        crumbs.length = 0;
    }

    this._deTarget = target;


    var p = am.isPickableDomElem,
        top = p(target.parentElement),
        right = p(target.nextElementSibling),
        bottom = p(target.firstElementChild),
        left = p(target.previousElementSibling);

    this._btnTop.style.display = top ? 'block' : 'none';
    this._btnRight.style.display = right ? 'block' : 'none';
    this._btnBottom.style.display = bottom ? 'block' : 'none';
    this._btnLeft.style.display = left ? 'block' : 'none';

    this.domElem.style.display = 'block';

    this._render();

    this._rerenderSetI = setInterval(this._render, 123);
    window.addEventListener('resize', this._render);

    this.emit('pick', target);
};

p.hide = function () {

    clearInterval(this._rerenderSetI);
    window.removeEventListener('resize', this._render);

    this.domElem.style.display = 'none';
};

p._render = function () {

    var br = this._deTarget.getBoundingClientRect();

    this.domElem.style.left = br.left + 'px';
    this.domElem.style.top = br.top + 'px';
    this.domElem.style.width = br.width + 'px';
    this.domElem.style.height = br.height + 'px';
};

p._onMMove =  function (e) {

    var br = this.domElem.getBoundingClientRect(),
        mx = e.clientX,
        my = e.clientY,
        s = this._isMouseOver ? 21 : 0,
        over = mx >= br.left-s && mx <= br.right+s &&
            my >= br.top-s && my <= br.bottom+s;

    if (over !== this._isMouseOver) {

        this._isMouseOver = over;

        var v = over ? 'visible' : 'hidden';

        this._btnTop.style.visibility = v;
        this._btnRight.style.visibility = v;
        this._btnBottom.style.visibility = v;
        this._btnLeft.style.visibility = v;
        this._btnClose.style.visibility = v;
    }
};

p._createBase = function () {

    var btnSize = 21;

    var de = document.createElement('div');
    de.style.position = 'fixed';
    de.style.boxSizing = 'border-box';
    de.style.boxShadow = '0px 0px 1px 0px rgba(50, 50, 50, 0.75)';
    de.style.display = 'none';
    de.style.pointerEvents = 'none';
    de.style.border = '2px dashed #eee';
    de.style.pointerEvents = 'none';
    am.deHandlerCont.appendChild(de);

    de.addEventListener('mouseenter', this._onMEnter);
    de.addEventListener('mouseleave', this._onMLeave);
    
    this.domElem = de;

    this._btnTop = createBtn('angle-up', 'up one level', function () {

        this.focusElem(this._deTarget.parentElement);
    }.bind(this));
    this._btnTop.style.top = -btnSize + 'px';
    this._btnTop.style.left = '0';
    this._btnTop.style.right = '0';
    this._btnTop.style.margin = '0 auto';


    this._btnRight = createBtn('angle-right', 'next sibling', function () {

        this.focusElem(this._deTarget.nextElementSibling);
    }.bind(this));
    this._btnRight.style.right = -btnSize + 'px';
    this._btnRight.style.top = '0';
    this._btnRight.style.bottom = '0';
    this._btnRight.style.margin = 'auto 0';

    this._btnBottom = createBtn('angle-down', 'down one level', function () {

        this.focusElem(this._crumbs[this._crumbs.length-1] || this._deTarget.firstElementChild);

    }.bind(this));
    this._btnBottom.style.bottom = -btnSize + 'px';
    this._btnBottom.style.left = '0';
    this._btnBottom.style.right = '0';
    this._btnBottom.style.margin = '0 auto';

    this._btnLeft = createBtn('angle-left', 'previous sibling', function () { 

        this.focusElem(this._deTarget.previousElementSibling);
    }.bind(this));
    this._btnLeft.style.left = -btnSize + 'px';
    this._btnLeft.style.top = '0';
    this._btnLeft.style.bottom = '0';
    this._btnLeft.style.margin = 'auto 0';

    this._btnClose = createBtn('cancel', 'close', function () {

        this.hide();
    }.bind(this));
    this._btnClose.style.right = -btnSize + 'px';
    this._btnClose.style.top = -btnSize + 'px';

    function createBtn(icon, tooltip, onClick) {

        var deIcon = amgui.createIconBtn({
            icon: icon,
            widht: btnSize,
            height: btnSize,
            onClick: function (e) {
                e.stopPropagation();
                onClick();
            },
            parent: de
        });

        amgui.addTooltip({
            deTarget: deIcon,
            text: tooltip
        });

        deIcon.style.position = 'absolute';
        deIcon.style.pointerEvents = 'auto';

        return deIcon;
    }
};
},{"../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\CssParameter.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var uncalc = require('./uncalc');
var Key = require('./Key');
var amgui = require('../../amgui');

function CssParameter (opt) {

    EventEmitter.call(this);

    this._keys = [];
    this._lineH =  21;

    this.deOptions = this._createParameterOptions();
    this.deKeyline = amgui.createKeyline({
        timescale: am.timeline.timescale
    });

    this._onChangeInput = this._onChangeInput.bind(this);
    this._onChangeTime = this._onChangeTime.bind(this);
    this._onChangeKeyTime = this._onChangeKeyTime.bind(this);
    this._onToggleKey = this._onToggleKey.bind(this);
    this._onDeleteKey = this._onDeleteKey.bind(this);

    if (!this._noBaseKeyValueInput) {

        this._input = amgui.createKeyValueInput({
            parent: this.deOptions,
            onChange: this._onChangeInput,
            height: this._lineH
        });
        this._input.style.flex = 1;
    }

    this._btnToggleKey = amgui.createIconBtn({
        icon: 'key',
        height: 21,
        parent: this.deOptions,
        onClick: this._onToggleKey,
    });
    this._refreshBtnToggleKey();

    am.timeline.on('changeTime', this._onChangeTime);

    if (opt) {
        this.useSave(opt);
    }
}

inherits(CssParameter, EventEmitter);
var p = CssParameter.prototype;









Object.defineProperty(p, 'height', {

    get: function () {
        
        return this._lineH;
    }
});





p.getSave = function () {

    var save = {
        name: this.name,
        keys: [],
    };

    this._keys.forEach(function (key) {

        save.keys.push(key.getSave());
    });

    return save;
};

p.useSave = function(save) {

    this.name = save.name;

    if (save.keys) {

        save.keys.forEach(this.addKey, this);
    }
};

p.getScriptKeys = function () {

    var keys = [];

    this._keys.forEach(function (key) {

        var k = {
            offset: key.time / am.timeline.length,
        };

        k[this.name] = this.getValue(key.time);
        
        if (key.ease && key.ease !== 'linear') {

           k.easing = key.ease; 
        }

        keys.push(k);
    }, this);

    keys.sort(function (a, b) {

        return a.offset - b.offset;
    });

    return keys;
};

p.getValue = function (time) {

    if (!_.isNumber(time)) {
        time = am.timeline.currTime;
    }

    var before, after, same;

    this._keys.forEach(function (key) {

        if (key.time === time) {
        
            same = key;
        }

        if (key.time < time && (!before || before.time < key.time)) {
        
            before = key;
        }

        if (key.time > time && (!after || after.time > key.time)) {
        
            after = key;
        }
    });

    if (same) {

        return same.value;
    }
    else {

        if (after && before) {

            var p = (time - before.time) / (after.time - before.time), 
                av = uncalc(after.value), bv = uncalc(before.value);

            p = this._applyEase(before.ease, p);

            return createCalc(av, bv, p);
        }
        else if (before) {
            
            return before.value;
        }
        else if (after) {
            
            return after.value;
        }
    }

    function createCalc(av, bv, p) {

        var avs = _.compact(av.split(' ')),
            bvs = _.compact(bv.split(' ')),
            avl = avs.length,
            bvl = bvs.length,
            ret = [];

        if (avl !== bvl) {

            if (avl < bvl) {

                avs = avs.concat(bvs.slice(avl));
            }
            else {
                bvs = bvs.concat(avs.slice(bvl));
            }         
        }

        avs.forEach(function (a, idx) {

            ret.push(calc(a, bvs[idx]));
        });

        return ret.join(' ');

        function calc(a, b) {

            return 'calc(' + b + ' + (' + a + ' - ' + b + ')*' + p + ')';
        }
    }
};

p.addKey = function (opt, skipHistory) {
    
    var key = this.getKey(opt.time);

    if (key) {

        if ('value' in opt) {

            if (!skipHistory) {
                am.history.saveChain(key, [this.addKey, this, key, true], [this.addKey, this, opt, true]);
            }

            key.value = opt.value;
        }
    }
    else {

        key = new Key(_.extend({deKeyline: this.deKeyline}, opt));
        key.value = opt.value || this.getValue(opt.time);

        key.on('changeTime', this._onChangeKeyTime);
        key.on('delete', this._onDeleteKey);

        this._keys.push(key);

        if (!skipHistory) {
            am.history.closeChain(key);
            am.history.save([this.removeKey, this, opt.time, true], [this.addKey, this, opt, true]);
        }
    }

    this._refreshInput();
    this._refreshBtnToggleKey();

    this.emit('change');

    return key;
};

p.removeKey = function (key, skipHistory) {

    if (typeof(key) === 'number') {

        key = this.getKey(key);
    }

    var idx = this._keys.indexOf(key);

    if (idx === -1) {

        return;
    }

    if (!skipHistory) {
        am.history.save([this.addKey, this, key, true],
            [this.removeKey, this, key, true]);
    }

    this._keys.splice(idx, 1);

    key.dispose();

    key.removeListener('changeTime', this._onChangeKeyTime);
    key.removeListener('delete', this._onDeleteKey);

    this._refreshBtnToggleKey();

    this.emit('change');
};

p.getKey = function (time) {

    return this._keys.find(function(key) {

        return key.time === time;
    });
};

p.getPrevKey = function (time) {

    var retKey;
    
    this._keys.forEach(function(key) {

        if (key.time < time && (!retKey || retKey.time < key.time)) {

            retKey = key;
        }
    });

    return retKey;
};

p.getNextKey = function (time) {

    var retKey;
    
    this._keys.forEach(function(key) {

        if (key.time > time && (!retKey || retKey.time > key.time)) {

            retKey = key;
        }
    });

    return retKey;
};

p.getKeyTimes = function () {

    var times = [];

    this._keys.forEach(function (key) {

        times.push(key.time);
    });

    return times;
};

p.isValid = function () {

    return !!(this.name && this._keys.length);
};









p._applyEase = function (ease, value) {

    var rx = /cubic-bezier\(\s*([\d\.]+)\s*,\s*([\d\.-]+)\s*,\s*([\d\.]+)\s*,\s*([\d\.-]+)\s*\)/,
        m = rx.exec(ease);

    if (!m) {
        return value;
    }
    
    var p = [0, 0, parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4]), 1, 1];

    count(0);
    count(2);
    count(4);
    count(0);
    count(2);
    count(0);

    return p[1];


    function count(i) {

        p[i+0] = p[i+0] + (p[i+2] - p[i+0]) * value;
        p[i+1] = p[i+1] + (p[i+3] - p[i+1]) * value;
    }
};








p._onChangeInput = function (e) {

    if ('key' in e.detail) {
        this.name = e.detail.key;
    }

    if ('value' in e.detail) {
        this.addKey({
            time: am.timeline.currTime,
            value: e.detail.value
        });
    }

    this.emit('change');
};

p._onChangeKeyTime = function () {

    this.emit('change');
};

p._onDeleteKey = function (key) {

    this.removeKey(key);
};

p._onChangeTime = function () {

    this._refreshInput();
    this._refreshBtnToggleKey();
};

p._onToggleKey = function () {

    var key = this.getKey(am.timeline.currTime);

    if (key) {
        this.removeKey(key);
    }
    else {
        this.addKey({time: am.timeline.currTime});
    }
};









p._refreshInput = function () {

    this._input.setKey(this.name);
    this._input.setValue(this.getValue());
};

p._refreshBtnToggleKey = function () {

    var key = this.getKey(am.timeline.currTime);
    this._btnToggleKey.style.color = key ? amgui.color.text : amgui.color.textInactive;
};












p._createParameterOptions = function () {

    var de = document.createElement('div');
    de.style.display = 'flex';
    de.style.width = '100%';
    de.style.height = this._lineH + 'px';
    de.style.background = 'linear-gradient(to bottom, #184F12 18%,#1B4417 96%)';

    amgui.bindDropdown({
        asContextMenu: true,
        deTarget: de,
        deMenu: amgui.createDropdown({
            options: [
                {text: 'move up', onSelect: this.emit.bind(this, 'move', this, -1)},
                {text: 'move down', onSelect: this.emit.bind(this, 'move', this, 1)},
                {text: 'delete', onSelect: this.emit.bind(this, 'delete', this)},
            ]
        })
    });

    return de;
};

p.dispose = function () {

    //TODO
};

module.exports = CssParameter;

},{"../../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","./Key":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\Key.js","./uncalc":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\uncalc.js","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\CssSequence.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var amgui = require('../../amgui');
var CssParameter = require('./CssParameter');
var CssTransformParameter = require('./CssTransformParameter');
var Key = require('./Key');
var Transhand = require('../../transhand/Transhand');
var mstPlayer = require('./script.player.mst');
var dialogSequOptions = require('./dialogSequOptions');

function CssSequence(opt) {

    EventEmitter.call(this);

    this._selectors = [];
    this._parameters = [];
    this._fill = 'forward';
    this._name = 'unnamed';
    this._iterations = 1;

    this._baseH = 21;
    this._selectedElems = [];
    this._headKeys = [];
    this._isShowingParams = false;
    this._isHidingSelectedElems = false;
    this._isPlaying = false;

    this._onSelectClick = this._onSelectClick.bind(this);
    this._onChangeHandler = this._onChangeHandler.bind(this);
    this._onChangeTime = this._onChangeTime.bind(this);
    this._onChangeParameter = this._onChangeParameter.bind(this);
    this._onDeleteParameter = this._onDeleteParameter.bind(this);
    this._onMoveParameter = this._onMoveParameter.bind(this);
    this._onChangeBlankParameter = this._onChangeBlankParameter.bind(this);
    this._onClickTgglKey = this._onClickTgglKey.bind(this);
    this._onClickTgglHide = this._onClickTgglHide.bind(this);
    this._onClickTgglShowParams = this._onClickTgglShowParams.bind(this);
    this._onClickName = this._onClickName.bind(this);
    this._onChangeName = this._onChangeName.bind(this);
    this._onChangeName = this._onChangeName.bind(this);
    this._onChangeFill = this._onChangeFill.bind(this);
    this._onChangeIterations = this._onChangeIterations.bind(this);
    this._onChangeSelectors = this._onChangeSelectors.bind(this);
    this._onWindowResize = this._onWindowResize.bind(this);
    this._animPlay = this._animPlay.bind(this);

    this.deOptions = document.createElement('div');
    this.deKeys = document.createElement('div');

    this._deHeadOptinos = this._createHeadOptions();
    this._deHeadKeyline = amgui.createKeyline({});
    this.deKeys.appendChild(this._deHeadKeyline);

    am.timeline.on('changeTime', this._onChangeTime);
    this.deOptions.addEventListener('click', this._onSelectClick);
    this.deKeys.addEventListener('click', this._onSelectClick);

    this._onChangeBlankParameter();

    if (opt) {
        this.useSave(opt);
    }
}

inherits(CssSequence, EventEmitter);
var p = CssSequence.prototype;

p.type = 'css_sequ_type';






Object.defineProperties(p, {

    height: {

        get: function () {

            var ret = this._baseH;

            if (this._isShowingParams) {

                this._parameters.forEach(function (param) {

                    ret += param.height;
                });
            }

            return ret;
        }
    },

    name: {
        set: function (v) {

            if (v === this._name) return;

            this._name = v;
            this._deName.textContent = this._name;
        },
        get: function () {

            return this._name;
        }
    },

    fill: {
        set: function (v) {

            if (v === this._fill) return;

            this._fill = v;
        },
        get: function () {

            return this._fill;
        }
    },

    iterations: {
        set: function (v) {

            if (v === this._iterations) return;

            this._iterations = v;
        },
        get: function () {

            return this._iterations;
        }
    }
});






p.getSave = function () {

    var save = {
        name: this.name,
        fill: this.fill,
        iterations: this.iterations,
        selectors: _.clone(this._selectors),
        parameters: [],
        isShowingParams: this._isShowingParams,
    };

    this._parameters.forEach(function (param) {

        save.parameters.push(param.getSave());
    });

    return save;
};

p.useSave = function (save) {

    if (!save) {
        return;
    }

    this._selectors = save.selectors || [];

    if ('name' in save) this.name = save.name;
    if ('fill' in save) this.fill = save.fill;
    if ('iterations' in save) this.iterations = save.iterations;

    if (save.parameters) {

        save.parameters.forEach(this.addParameter, this);
    }

    this._selectElements();
    this._refreshHeadKeyline();
    this._refreshTgglKey();

    if (save.isShowingParams) {

        this._showParams();
    }
};

p.getScript = function () {

    var paramKeys = [], code = '', options, selectors;

    this._parameters.forEach(function (param) {

        paramKeys.push(param.getScriptKeys());
    });

    options = {
      direction: "normal",
      duration: am.timeline.length,
      iterations: this.iterations,
      fill: this.fill,
    };

    selectors = this._selectors.join(',').replace('\\','\\\\');

    code = Mustache.render(mstPlayer, {
        paramKeys: JSON.stringify(paramKeys),
        options: JSON.stringify(options),
        selectors: selectors
    });

    return code;
};

p.addParameter = function (opt, skipHistory) {

    opt = opt || {};

    var param = this._getParameter(opt.name);
    

    if (param) {

        return param;
    }
    else {

        if (opt.name === 'transform') {

            param = new CssTransformParameter(opt);
        }
        else {

            param = new CssParameter(opt);
        }

        if (!skipHistory) {
            am.history.save([this.removeParameter, this, param, true],
                [this.addParameter, this, param, true]);
        }

        this._parameters.push(param);
        param.on('change', this._onChangeParameter);
        param.on('delete', this._onDeleteParameter);
        param.on('move', this._onMoveParameter);

        this._refreshParameterOrdering();
        this._moveBlankParameterDown();
        this.emit('changeHeight', this);

        return param;
    }
};

p.removeParameter = function (param, skipHistory) {

    if (!skipHistory) {
        am.history.save([this.addParameter, this, param, true],
            [this.removeParameter, this, param, true]);
    }

    var idx = this._parameters.indexOf(param);

    if (idx === -1) {
        return;
    }

    this._parameters.splice(idx, 1);

    param.removeListener('change', this._onChangeParameter);
    param.removeListener('delete', this._onDeleteParameter);
    param.removeListener('move', this._onMoveParameter);

    $(param.deOptions).remove();
    $(param.deKeyline).remove();
};

p.moveParameter = function (param, way) {

    var idx = this._parameters.indexOf(param);

    this._parameters.splice(idx, 1);
    idx = Math.min(this._parameters.length, Math.max(0, idx + way));
    this._parameters.splice(idx, 0, param);

    this._refreshParameterOrdering();
};

p.select = function (opt) {

    opt = opt || {};

    if (this._isSelected) return;
    this._isSelected = true;


    if (!this._handler) {
        this._handler = new Transhand();
    }

    this._handler.on('change', this._onChangeHandler);
    window.addEventListener('resize', this._onWindowResize);

    this._selectElements();

    if (this._selectedElems.length) {

        this._focusHandler(opt.focusElem || this._selectedElems[0]);
    }

    this.deHighlight.style.opacity = 1;

    this.emit('select', this);
};

p.deselect = function () {

    if (!this._isSelected) return;
    this._isSelected = false;

    this._blurHandler();

    this.deHighlight.style.opacity = 0;

    window.removeEventListener('resize', this._onWindowResize);

    if (this._handler) {

        this._handler.removeListener('change', this._onChangeHandler);
    }
};

p.renderTime = function (time) {

    if (this._selectors.length === 0) {
        return;
    }

    var selection = _.toArray(am.deRoot.querySelectorAll(this._selectors.join(',')));

    this._parameters.forEach(function (param) {

        selection.forEach(function (de) {

            de.style[param.name] = param.getValue(time);
        });
    });
};

p._onPick = function (de) {

    var items = am.deRoot.querySelectorAll(this.selectors.join(','));

    if (items.indexOf(de)) {

        this.select();
    }
};

p.play = function () {

    this._isPlaying = true;

    this._animPlay();
};

p.pause = function () {

    this._isPlaying = false;

    window.cancelAnimationFrame(this._animPlayRafid);
};

p.getMagnetPoints = function () {

    var times = [];

    this._headKeys.forEach(function (key) {

        times.push(key.time);
    });

    return times;
};










p._animPlay = function () {

    this._animPlayRafid = window.requestAnimationFrame(this._animPlay);

    this.renderTime(am.timeline.currTime);
};

p._focusHandler = function (de) {

    de = de || this._currHandledDe;
    this._currHandledDe = de;

    if (!this._currHandledDe) return this._blurHandler();

    var transformSave;
    if (de.style.transform) {
        transformSave = de.style.transform;
        de.style.transform = '';
    }

    var br = de.getBoundingClientRect();

    de.style.transform = transformSave;

    var handOpt = {
        type: 'transformer',
        base: {
            x: br.left,
            y: br.top,
            w: br.width,
            h: br.height,
        },
        params: {}
    };
    var transformParam = this._getParameter('transform');
    var transformOriginParam = this._getParameter('transform-origin');

    if (transformParam instanceof CssTransformParameter) {

        _.extend(handOpt.params, transformParam.getRawValue());
    }

    if (transformOriginParam) {

        var val = transformOriginParam.getValue(),
            match = /\s*([\d\.]+)%\s*([\d\.]+)%/.exec(val);

        if (match) {
            handOpt.params.ox = match[1] / 100;
            handOpt.params.oy = (match[2] || match[1]) / 100;
        }
    }

    this._handler.setup({
        hand: handOpt
    });
    this._handler.activate();

    am.deHandlerCont.appendChild(this._handler.domElem);
};

p._blurHandler = function () {

    this._currHandledDe = undefined;

    if (this._handler && this._handler.domElem && this._handler.domElem.parentNode) {

        this._handler.deactivate();
        this._handler.domElem.parentNode.removeChild(this._handler.domElem);
    }
};

p._moveBlankParameterDown = function () {

    if (!this._blankParameter) {
        return;
    }

    var idx = this._parameters.indexOf(this._blankParameter);

    if (idx < this._parameters.length - 1) {

        this.moveParameter(this._blankParameter, (this._parameters.length - 1) - idx);
    }
};

p._hideSelectedElems = function () {

    if (this._isHidingSelectedElems) return;
    this._isHidingSelectedElems = true;

    this._tgglHide.setToggle(true);

    this._selectedElems.forEach(function (de) {

        de._amVisibilitySave = de.style.visibility;
        de.style.visibility = 'hidden';
    });
};

p._showSelectedElems = function () {

    if (!this._isHidingSelectedElems) return;
    this._isHidingSelectedElems = false;

    this._tgglHide.setToggle(false);

    this._selectedElems.forEach(function (de) {

        de.style.visibility = de._amVisibilitySave;
    });
};

p._showParams = function () {

    if (this._isShowingParams) return;
    this._isShowingParams = true;

    this._tgglParams.setToggle(true);
    this.emit('changeHeight', this);
};

p._hideParams = function () {

    if (!this._isShowingParams) return;
    this._isShowingParams = false;

    this._tgglParams.setToggle(false);
    this.emit('changeHeight', this);
};








p._onSelectClick = function () {

    this.select();
};

p._onChangeHandler = function(params, type) {

    var time = am.timeline.currTime, 
        prop, value;

    if (type === 'transform') {

        Object.keys(params).forEach(function (name) {

            if (name === 'tx' || name === 'ty' || name === 'tz' ||
                name === 'rx' || name === 'ry' || name === 'rz' ||
                name === 'sx' || name === 'sy' || name === 'sz')
            {
                value = {};
                value[name] = params[name];

                prop = this.addParameter({name: 'transform'});
                prop.addKey({
                    time: time,
                    value: value
                });
            }
        }, this);

        if ('ox' in params && 'oy' in params) {

            prop = this.addParameter({name: 'transform-origin'});
            prop.addKey({
                time: time,
                value: (params.ox*100).toFixed(2) + '% ' + (params.oy*100).toFixed(2) + '%'
            });
        }
    }

    this.renderTime(time);
    this._focusHandler();
};

p._onChangeTime = function (time) {

    if (this._isPlaying) {
        return;
    }

    this.renderTime(time);
    this._focusHandler();
    this._refreshTgglKey();
};

p._onChangeParameter = function () {

    this.renderTime();
    this._focusHandler();
    this._refreshHeadKeyline();
    this._refreshTgglKey();

    this.emit('change');
};


p._onWindowResize = function () {

    this._focusHandler();
};

p._onDeleteParameter = function (param) {

    this.removeParameter(param);
};

p._onMoveParameter = function (param, way) {

    this.moveParameter(param, way);
};

p._onChangeBlankParameter = function () {

    if (this._blankParameter) {

        this._blankParameter.removeListener('change', this._onChangeBlankParameter);
        this._blankParameter = undefined;
    }

    this._blankParameter = this.addParameter();
    this._blankParameter.on('change', this._onChangeBlankParameter);
};

p._onClickTgglKey = function () {

    var time = am.timeline.currTime,
        allHaveKey = this._isAllParamsHaveKey(time),
        flag = am.history.startFlag();

    this._parameters.forEach(function (param) {

        if (param.isValid()) {

            if (allHaveKey) {
                param.removeKey(param.getKey(time));
            }
            else {
                param.addKey({time: time});
            }
        }
    });

    this._refreshTgglKey();

    am.history.endFlag(flag);
};

p._onClickTgglShowParams = function () {

    if (this._isShowingParams) {
        this._hideParams();
    }
    else {
        this._showParams();
    }
};

p._onClickTgglHide = function () {

    if (this._isHidingSelectedElems) {
        this._showSelectedElems();
    }
    else {
        this._hideSelectedElems();
    }
};

p._onClickName = function () {

    dialogSequOptions.show({
        name: this._name,
        selectors: this._selectors,
        fill: this.fill,
        iterations: this.iterations,
        onChangeName: this._onChangeName,
        onChangeFill: this._onChangeFill,
        onChangeIterations: this._onChangeIterations,
        onChangeSelectors: this._onChangeSelectors
    });
};

p._onChangeName = function (name) {

    this.name = name;
};

p._onChangeFill = function (fill) {

    this.fill = fill;
};

p._onChangeIterations = function (itarations) {

    this.iterations = itarations;
};

p._onChangeSelectors = function (selectors) {

    this._selectors.length = 0;
    this._selectors = this._selectors.concat(selectors);

    this._selectElements();

    if (this._selectedElems.indexOf(this._currHandledDe) === -1) {

        this._currHandledDe = undefined;
    }

    this._focusHandler(this._currHandledDe || this._selectedElems[0]);
};











p._isAllParamsHaveKey = function (time) {

    return this._parameters.every(function (param) {

        return param.getKey(time) || !param.isValid();
    });
};

p._getParameter = function (name) {

    return this._parameters.find(function(param) {

        return param.name === name;
    });
};

p._refreshTgglKey = function () {

    this._tgglKey.setToggle( this._isAllParamsHaveKey(am.timeline.currTime));
};


p._refreshHeadKeyline = function () {

    var times = [], oldKeys = this._headKeys.splice(0);

    this._parameters.forEach(function (param) {

        times = times.concat(param.getKeyTimes());
    });

    times = _.uniq(times);

    times.forEach(function (time) {

        var key = oldKeys.pop() || new Key({
            deKeyline: this._deHeadKeyline,
            ease: 'none',
            color: '#063501'
        });

        key.domElem.style.pointerEvents = 'none';//hack! until finish the control with head keys

        key.time = time;

        this._headKeys.push(key);
    }, this);

    _.invoke(_.difference(oldKeys, this._headKeys), 'dispose');
};

p._refreshParameterOrdering = function () {

    this._parameters.forEach(function (param) {

        this.deOptions.appendChild(param.deOptions);
        this.deKeys.appendChild(param.deKeyline);
    }, this);
};











p._createHeadOptions = function (){

    var de = document.createElement('div');
    de.style.position = 'relative';
    de.style.width = '100%';
    de.style.display = 'flex';
    de.style.height = this._baseH + 'px';
    de.style.background = 'linear-gradient(to bottom, #063501 18%,#064100 96%)';
    this.deOptions.appendChild(de);

    this.deHighlight = document.createElement('div');
    this.deHighlight.style.display = 'inline-block';
    this.deHighlight.style.width = '2px';
    this.deHighlight.style.height = this._baseH + 'px';
    this.deHighlight.style.background = 'gold';
    this.deHighlight.style.opacity = 0;
    de.appendChild(this.deHighlight);

    this._tgglParams = amgui.createToggleIconBtn({
        iconOn: 'angle-down',
        iconOff: 'angle-right',
        height: this._baseH,
        onClick: this._onClickTgglShowParams,
        parent: de
    });

    this._deName = amgui.createLabel({caption: this._name, parent: de});
    this._deName.style.height = this._baseH  + 'px';
    this._deName.style.cursor = 'pointer';
    this._deName.addEventListener('click', this._onClickName);

    var deNameIcon = amgui.createIcon({
        icon: 'cog',
        parent: de
    });
    deNameIcon.style.display = 'none';
    this._deName.addEventListener('mouseenter', function () {deNameIcon.style.display = 'inline-block';});
    this._deName.addEventListener('mouseleave', function () {deNameIcon.style.display = 'none';});

    var space = document.createElement('div');
    space.style.display = 'inline-block';
    space.style.flex = '1';
    space.style.pointerEvents = 'none';
    de.appendChild(space);

    this._tgglHide = amgui.createToggleIconBtn({
        iconOn: 'eye-off', 
        iconOff: 'eye', 
        height: this._baseH,
        defaultToggle: false,
        onClick: this._onClickTgglHide,
        changeColor: true,
        parent: de
    });

    this._tgglKey = amgui.createToggleIconBtn({
        icon: 'key',
        height: this._baseH,
        onClick: this._onClickTgglKey,
        changeColor: true,
        parent: de
    });
    this._refreshTgglKey();

    amgui.bindDropdown({
        asContextMenu: true,
        deTarget: de,
        deMenu: amgui.createDropdown({
            options: [
                {text: 'move up', onSelect: this.emit.bind(this, 'move', this, -1)},
                {text: 'move down', onSelect: this.emit.bind(this, 'move', this, 1)},
                {text: 'delete', onSelect: this.emit.bind(this, 'delete', this)},
            ]
        })
    });

    return de;
};

p.isOwnedDomElem = function (de) {

    return this._selectedElems.indexOf(de) !== -1;
};

p._selectElements = function () {

    var list = [];

    this._selectors.forEach(function (selector) {

        var items = am.deRoot.querySelectorAll(selector);
        items = Array.prototype.slice.call(items);
        list = list.concat(items);
    });

    this._selectedElems = list;
};

p.dispose = function () {

    am.timeline.removeListener('changeTime', this._onChangeTime);

    //TODO
};

module.exports = CssSequence;





},{"../../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","../../transhand/Transhand":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\transhand\\Transhand.js","./CssParameter":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\CssParameter.js","./CssTransformParameter":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\CssTransformParameter.js","./Key":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\Key.js","./dialogSequOptions":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\dialogSequOptions.js","./script.player.mst":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\script.player.mst","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\CssTransformParameter.js":[function(require,module,exports){
'use strict';

var inherits = require('inherits');
var CssParameter = require('./CssParameter');
var Key = require('./Key');
var amgui = require('../../amgui');

var BASE_VALUES = {
    tx: 0, ty: 0, tz: 0,
    rx: 0, ry: 0, rz: 0,
    sx: 1, sy: 1, sz: 1,
    skewX: 0, skewY: 0,
    perspective: 0
};

var PRECISIONS = { 
    tx: 0, ty: 0, tz: 0,
    rx: 2, ry: 2, rz: 2,
    sx: 2, sy: 2, sz: 2,
    skewX: 2, skewY: 2,
    perspective: 0
};

function CssTransformParameter (opt) {

    this._noBaseKeyValueInput = true;

    this._inputs = {};
    this._inputs3d = [];
    this._lineCount = 6;

    CssParameter.call(this, _.extend({name: 'transform'}, opt));

    this._onToggle3d = this._onToggle3d.bind(this);

    this._createTransformInputs();

    this._btnToggle3d = amgui.createIconBtn({
        icon: 'cube',
        height: 21,
        parent: this.deOptions,
        onClick: this._onToggle3d,
    });
    this.deOptions.insertBefore(this._btnToggle3d, this._btnToggleKey);
    
    this._showing3d = !this._showing3d;//TODO do this somehow else!
    this._showHide3d(!this._showing3d);
}

inherits(CssTransformParameter, CssParameter);
var p = CssTransformParameter.prototype;


p.getSave = function () {

    var save = CssParameter.prototype.getSave.call(this);

    save.showing3d = this._showing3d;

    return save;
};

p.useSave = function(save) {

    CssParameter.prototype.useSave.call(this, save);

    this._showing3d = !!save.showing3d;
};

p.getValue = function (time) {

    return convertTransformValue(this.getRawValue(time));
};

p.getRawValue = function (time) {

    if (!_.isNumber(time)) {
        time = am.timeline.currTime;
    }

    var before, after, same;

    this._keys.forEach(function (key) {

        if (key.time === time) {
        
            same = key;
        }

        if (key.time < time && (!before || before.time < key.time)) {
        
            before = key;
        }

        if (key.time > time && (!after || after.time > key.time)) {
        
            after = key;
        }
    });

    if (same) {

        return same.value;
    }
    else {

        if (after && before) {

            var calculated = {},
                p = (time - before.time) / (after.time - before.time),
                av = after.value,
                bv = before.value;

            p = this._applyEase(before.ease, p);

            Object.keys(bv).forEach(function (name) {

                if (name in av) {

                    calculated[name] = bv[name] + (av[name] - bv[name]) * p;
                }
                else {
                    calculated[name] = bv[name];
                }
            });

            return calculated;
        }
        else if (before) {
            
            return _.clone(before.value);
        }
        else if (after) {
            
            return _.clone(after.value);
        }
        else {
            return _.clone(BASE_VALUES);
        }
    }
};

p.addKey = function (opt, skipHistory) {

    var key = this.getKey(opt.time);

    if (key) {

        if ('value' in opt) {

            if (!skipHistory) {
                am.history.saveChain(key, 
                    [this.addKey, this, _.cloneDeep(key.getSave()), true], 
                    [this.addKey, this, _.cloneDeep(opt), true]);
            }
            
            key.value = _.extend(key.value, opt.value);
        }
    }
    else {
        key = new Key(_.extend({deKeyline: this.deKeyline}, opt));
        key.value = _.extend(this.getRawValue(opt.time), opt.value);

        key.on('changeTime', this._onChangeKeyTime);
        key.on('delete', this._onDeleteKey);

        this._keys.push(key);

        if (!skipHistory) {
            am.history.closeChain(key);
            am.history.save(
                [this.removeKey, this, opt.time, true], 
                [this.addKey, this, opt, true]);
        }
    }

    this._refreshInput();
    this._refreshBtnToggleKey();

    this.emit('change');

    return key;
};

p._refreshInput = function () {

    var inputs = this._inputs,
        values = this.getRawValue();

    Object.keys(inputs).forEach(function (key) {

        if (inputs[key].value !== values[key]) {

            inputs[key].value = values[key].toFixed(PRECISIONS[key]);
        }
    });
};

Object.defineProperty(p, 'height', {

    get: function () {
        
        return this._lineH * this._lineCount;
    }
});

p._onChangeInput = function (e) {

    var inp = e.currentTarget,
        value = {};

    value[inp._key] = parseFloat(inp.value);

    this.addKey({
        time: am.timeline.currTime,
        value: value,
    });
};

p._onToggle3d = function () {

    this._showHide3d(!this._showing3d);
};

p._showHide3d = function (show) {

    if (this._showHide3d === show) {
        return;
    }

    this._showing3d = show;

    this._btnToggle3d.style.color = show ? amgui.color.text : amgui.color.textInactive;

    this._inputs3d.forEach(function (de) {

        de.style.visibility = show ? $(de).show() : $(de).hide();
    });
};

p._createTransformInputs = function () {

    var deOptions = this.deOptions,
        lineH = this._lineH,
        inputs = this._inputs,
        inputs3d = this._inputs3d,
        onChangeInput = this._onChangeInput;

    deOptions.style.height = (lineH * this._lineCount) + 'px';
    deOptions.style.flexWrap = 'wrap';

    this.deKeyline.style.height = lineH + 'px';
    this.deKeyline.style.marginBottom = (lineH * (this._lineCount-1)) + 'px';

    var label = document.createElement('span');
    label.textContent = 'transform';
    label.style.flex = '1';
    label.style.height = lineH + 'px';
    $(deOptions).prepend(label);

    var row = createRow();
    createInput('tx', 'tx', row);
    createInput('ty', 'y', row);
    createInput('tz', 'z', row, true);
    row = createRow();
    createInput('rx', 'rx', row, true);
    createInput('ry', 'y', row, true);
    createInput('rz', 'rz', row);
    row = createRow();
    createInput('sx', 'sx', row);
    createInput('sy', 'y', row);
    createInput('sz', 'z', row, true);
    row = createRow();
    createInput('skewX', 'skewX', row);
    createInput('skewY', 'skewY', row);
    row = createRow(true);
    createInput('perspective', 'perspective', row);

    function createRow(i3d) {

        var de = document.createElement('div');
        de.style.display = 'flex';
        de.style.width = '100%';
        de.style.height = lineH + 'px';
        // de.style.background = 'linear-gradient(to bottom, #184F12 18%,#1B4417 96%)';
        if (i3d) {
            inputs3d.push(de);
        }
        deOptions.appendChild(de);
        return de;
    }

    function createInput(key, caption, parent, i3d) {

        var label = document.createElement('span');
        label.textContent = caption;
        parent.appendChild(label);

        var inp = document.createElement('input');
        inp._key = key;
        inp.type = 'number';
        inp.value = BASE_VALUES[key];
        inp.style.flex = '1';
        inp.style.fontFamily = amgui.FONT_FAMILY;
        inp.style.background = 'rgba(255,255,255,.12)';
        inp.style.border = 'none';
        inp.style.margin = '0 0 0 3px';
        inp.style.color = amgui.color.text;
        inp.addEventListener('change', onChangeInput);
        parent.appendChild(inp);

        if (i3d) {
            inputs3d.push(label, inp);
        }
        inputs[key] = inp;
    }
};

function convertTransformValue(v) {

    var tx = 'tx' in v && v.tx !== BASE_VALUES.tx,
        ty = 'ty' in v && v.ty !== BASE_VALUES.ty,
        tz = 'tz' in v && v.tz !== BASE_VALUES.tz,
        rx = 'rx' in v && v.rx !== BASE_VALUES.rx,
        ry = 'ry' in v && v.ry !== BASE_VALUES.ry,
        rz = 'rz' in v && v.rz !== BASE_VALUES.rz,
        sx = 'sx' in v && v.sx !== BASE_VALUES.sx,
        sy = 'sy' in v && v.sy !== BASE_VALUES.sy,
        sz = 'sz' in v && v.sz !== BASE_VALUES.sz,
        skewX = 'skeewX' in v && v.skewX !== BASE_VALUES.skewX,
        skewY = 'skeewY' in v && v.skewY !== BASE_VALUES.skewY,
        perspective = 'perspective' in v && v.perspective !== BASE_VALUES.perspective,
        ret = '';

    if (tx && ty && tz) ret += 'translate3d('+v.tx+'px,'+v.ty+'px,'+v.tz+'px) ';
    else if (tx && ty) ret += 'translate('+v.tx+'px,'+v.ty+'px) ';
    else {
        if (tx) ret += 'translateX('+v.tx+'px) ';
        if (ty) ret += 'translateY('+v.ty+'px) ';
        if (tz) ret += 'translateZ('+v.tz+'px) ';
    }

    // if (rx && ry && rz) ret += 'rotate3d('+v.rx+'rad,'+v.ry+'rad,'+v.rz+'rad) ';
    // else {
        if (rx) ret += 'rotateX('+v.rx+'rad) ';
        if (ry) ret += 'rotateY('+v.ry+'rad) ';
        if (rz) ret += 'rotate('+v.rz+'rad) ';
    // }

    if (sx && sy && sz) ret += 'scale3d('+v.sx+','+v.sy+','+v.sz+') ';
    else if (sx && sy) ret += 'scale('+v.sx+','+v.sy+') ';
    else {
        if (sx) ret += 'scaleX('+v.sx+') ';
        if (sy) ret += 'scaleY('+v.sy+') ';
        if (sz) ret += 'scaleZ('+v.sz+') ';
    }

    if (skewX && skewY) ret += 'skew('+v.skewx+'rad,'+v.skewY+'rad) ';
    else if (skewX) ret += 'skewX('+v.skewX+'rad) ';
    else if (skewY) ret += 'skewY('+v.skewY+'rad) ';

    if(perspective) ret += 'perspective('+v.perspective+'px) ';
// console.log(ret)
    return ret;
}

module.exports = CssTransformParameter;

},{"../../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","./CssParameter":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\CssParameter.js","./Key":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\Key.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\Key.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var dialogKeyOptions = require('./dialogKeyOptions');
var amgui = require('../../amgui');

function Key (opt) {

    EventEmitter.call(this);
    
    this._time =  0;
    this._value =  '';
    this._ease = 'linear';
    this._deKeyline = opt.deKeyline;

    this._onChangeDeTime = this._onChangeDeTime.bind(this);
    this._onSelectDropdown = this._onSelectDropdown.bind(this);
    this._onChangeEase = this._onChangeEase.bind(this);
    this._onChangeTape = this._onChangeTape.bind(this);

    this.domElem = this._deKeyline.addKey({
        timescale: am.timeline.timescale,
        time: this.time,
        ease: this.ease,
        color: opt.color
    });

    this._deMenu = amgui.createDropdown({
        options: ['ease', 'delete']
    });
    this._deMenu.addEventListener('select', this._onSelectDropdown);

    this.domElem.addEventListener('changeTime', this._onChangeDeTime);
    am.timeline.on('changeTape', this._onChangeTape);

    amgui.bindDropdown({
        deTarget: this.domElem,
        deMenu: this._deMenu,
        asContextMenu: true
    });

    if (opt) {
        this.useSave(opt);
    }
}

inherits(Key, EventEmitter);
var p = Key.prototype;

Object.defineProperties(p, {

    time: {
        set: function (v) {

            if (!Number.isFinite(v) || this._time === v) return;

            this._time = parseInt(v);

            this.domElem.setTime(this._time);
        },
        get: function () {

            return this._time;
        }
    },
    value: {
        set: function (v) {

            if (this._value === v) return;

            this._value = v;
        },
        get: function () {

            return this._value;
        }
    },
    ease: {
        set: function (v) {

            if (!v || this._ease === v) return;

            this._ease = v;

            this.domElem.setEase(v);

            this.emit('changeEase', v);
        },
        get: function () {

            return this._ease;
        }
    }
});


p.getSave = function () {

    return {
        value: this.value,
        time: this.time,
        ease: this.ease
    };
};

p.useSave = function (save) {

    this.value = save.value;
    this.time = save.time;
    this.ease = save.ease;
};

p._onChangeDeTime = function (e) {

    this.time = e.detail.time;

    this.emit('changeTime');
};

p._onSelectDropdown = function (e) {
    
    var selection = e.detail.selection;

    if (selection === 'ease') {

        dialogKeyOptions.show({
            ease: this.ease,
        });
        
        dialogKeyOptions.on('changeEase', this._onChangeEase);
    }
    else if (selection === 'delete') {

        this.emit('delete', this);
    }
};

p._onChangeEase = function (ease) {

    this.ease = ease;
};

p._onChangeTape = function () {

    this.domElem.setTimescale(am.timeline.timescale);
};

p.dispose = function () {

    this.domElem.removeEventListener('changeTime', this._onChangeDeTime);
    this._deMenu.removeEventListener('select', this._onSelectDropdown);
    am.timeline.removeListener('changeTape', this._onChangeTape);

    this.domElem.remove();
    if (this._deMenu.parentNode) this._deMenu.parentNode.removeChild(this._deMenu); 
};

module.exports = Key;

},{"../../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","./dialogKeyOptions":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\dialogKeyOptions.js","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\cssModule.js":[function(require,module,exports){
'use strict';

var CssSequence = require('./CssSequence');
var qsgen = require('../../qsgen');

var am, iconNew;

exports.init = function (_am) {

    am = _am;

    am.registerSequenceType(CssSequence, CssSequence.prototype.type);

    am.on('selectDomElement', onSelectDomElement);
};

function onSelectDomElement(de) {

    if (!am.timeline.sequences.some(testSequ)) {

        var iconOpt;

        if (iconNew) {

            iconOpt = { deIcon: iconNew };
        }
        else {
            iconOpt = {
            
                icon: 'plus-squared',
                backgound: '#063501',
                tooltip: 'new sequence with selected elem',

                onClick: function () {

                    am.toolbar.removeIcon(iconNew);
                    am.domPicker.hide();

                    var selector = qsgen(am.selectedElement);
                    console.log('selector:', selector);

                    var sequ = new CssSequence({
                        selectors: [selector],
                        name: selector
                    });

                    am.timeline.addSequence(sequ);

                    sequ.select();
                }
            };
        }

        iconNew = am.toolbar.addIcon(iconOpt);
    }

    function testSequ(sequ) {

        if (sequ instanceof CssSequence && sequ.isOwnedDomElem(de)) {

            console.log('is owned', de);
            sequ.select({focusElem: de});
            am.domPicker.hide();
            return true;
        }
    }
}
},{"../../qsgen":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\qsgen.js","./CssSequence":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\CssSequence.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\dialogKeyOptions.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var amgui = require('../../amgui');

function DialogKeyOptions () {

    EventEmitter.call(this);

    this._onSelectEase = this._onSelectEase.bind(this);
    this._onChangeEase = this._onChangeEase.bind(this);
    this._onChangeBezier = this._onChangeBezier.bind(this);
    this._onClickOk = this._onClickOk.bind(this); 
}

inherits(DialogKeyOptions, EventEmitter);
var p = DialogKeyOptions.prototype;

Object.defineProperties(p, {

    ease: {

        set: function (v) {

            if (this._ease === v) return;
            
            this._inpEase.value = v;
            this._beizerEditor.setValue(v);

            this.emit('changeEase', v);
        },
        get: function () {

            return this._ease;
        }
    }
});


p.show = function (opt) {

    opt = opt || {};

    this._createDialog();

    this.ease = opt.ease;

    this.domElem.showModal();
};

p.hide = function () {

    this.domElem.close();

    this.removeAllListeners('changeEase');
};

p._createDialog = function () {

    if (this._isDialogCreated) return;
    this._isDialogCreated = true;

    this._createContent();
    
    this.domElem = amgui.createDialog({
        title: 'Key',
        content: this._deContent,
        parent: am.deDialogCont,
        buttons: ['ok'],
    });

    this.domElem.addEventListener('click_ok', this._onClickOk);
};

p._createContent = function () {

    this._deContent = document.createElement('div');
    this._deContent.style.width = '330px';
    this._deContent.style.padding = '30px 12px';

    this._deLabelEase = document.createElement('span');
    this._deLabelEase.textContent = 'ease: ';
    this._deContent.appendChild(this._deLabelEase);

    this._inpEase = document.createElement('input');
    this._inpEase.type = 'text';
    this._inpEase.value = 'linear';
    this._inpEase.style.width = '245px';
    this._inpEase.style.fontSize = '14px';
    this._inpEase.style.fontFamily = amgui.FONT_FAMILY;
    this._inpEase.style.background = 'none';
    this._inpEase.style.border = 'none';
    this._inpEase.style.color = amgui.color.text;
    this._inpEase.addEventListener('change', this._onChangeEase);
    this._deContent.appendChild(this._inpEase);

    this._btnSelectEase = amgui.createIconBtn({
        icon: 'chart-bar',
        display: 'inline'
    });
    this._btnSelectEase.style.marginLeft = '4px';
    this._deContent.appendChild(this._btnSelectEase);

    amgui.bindDropdown({
        deTarget: this._btnSelectEase,
        deMenu: amgui.createDropdown({
            options: ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'steps(1)', 'cubic-bezier(0,0,1,1)'],
            onSelect: this._onSelectEase,
        }),
        menuParent: this._deContent
    });

    this._beizerEditor = amgui.createBezierEditor({
        // width: 330,
        // height: 330,
        parent: this._deContent,
        onChange: this._onChangeBezier
    });
};

p._onClickOk = function () {

    this.hide();
};

p._onSelectEase = function (e) {

    this.ease = e.detail.selection;
};

p._onChangeEase = function () {

    this.ease = this._inpEase.value;
};

p._onChangeBezier = function (e) {

    this.ease = e.detail.value;
};

module.exports = new DialogKeyOptions();

},{"../../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\dialogSequOptions.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var amgui = require('../../amgui');

function DialogSequOptions () {

    EventEmitter.call(this);

    this._name = '';
    this._selectors = [];

    this._onClickOk = this._onClickOk.bind(this); 
    this._onChangeName = this._onChangeName.bind(this); 
    this._onSelectFill = this._onSelectFill.bind(this); 
    this._onChangeIterations = this._onChangeIterations.bind(this); 
}

inherits(DialogSequOptions, EventEmitter);
var p = DialogSequOptions.prototype;



Object.defineProperties(p, {

    name: {
        set: function (v) {

            if (this._name === v) {
                return;
            }

            this._name = v;
            this._inpName.value = v;
            this.emit('changeName', v);
        },
        get: function () {
            return this._name;
        }
    },

    selectors: {
        set: function (v) {

            this._selectors.slice().map(this._removeSelector, this);
            v.map(this._addSelector, this);
            this.emit('changeSelectors', this.selectors);
        },
        get: function () {
            return _.pluck(this._selectors, 'value'); 
        }
    },

    fill: {
        set: function (v) {

            if (this._fill === v) {
                return;
            }

            this._fill = v;
            this._deFill.textContent = v;
            this.emit('changeFill', v);
        },
        get: function () {
            return this._fill;
        }
    },

    iterations: {
        set: function (v) {

            if (this._iterations === v) {
                return;
            }

            this._iterations = v;
            this._inpIterations.value = v;
            this.emit('changeIterations', v);
        },
        get: function () {
            return this._iterations;
        }
    },
});

p.show = function (opt) {

    opt = opt || {};

    this._createDialog();

    if ('name' in opt) this.name = opt.name;
    if ('fill' in opt) this.fill = opt.fill;
    if ('iterations' in opt) this.iterations = opt.iterations;
    if ('selectors' in opt) this.selectors = opt.selectors;

    if ('onChangeName' in opt) this.on('changeName', opt.onChangeName);
    if ('onChangeFill' in opt) this.on('changeFill', opt.onChangeFill);
    if ('onChangeIterations' in opt) this.on('changeIterations', opt.onChangeIterations);
    if ('onChangeSelectors' in opt) this.on('changeSelectors', opt.onChangeSelectors);

    this.domElem.showModal();
};

p.hide = function () {

    this.domElem.close();

    this.removeAllListeners('changeName');
    this.removeAllListeners('changeFill');
    this.removeAllListeners('changeIterations');
    this.removeAllListeners('changeSelectors');
};

p._createDialog = function () {

    if (this._isDialogCreated) return;
    this._isDialogCreated = true;

    this._createContent();
    
    this.domElem = amgui.createDialog({
        title: 'Sequence',
        content: this._deContent,
        parent: am.deDialogCont,
        buttons: ['ok'],
    });

    this.domElem.addEventListener('click_ok', this._onClickOk);
};

p._onClickOk = function () {

    this.hide();
};

p._onChangeName = function () {

    this.name = this._inpName.value;
};

p._onSelectFill = function (e) {

    this.fill = e.detail.selection;
};

p._onChangeIterations = function () {

    this.iterations = parseInt(this._inpIterations.value);
};


p._createContent = function () {

    this._deContent = document.createElement('div');
    this._deContent.style.width = '330px';
    this._deContent.style.padding = '30px 12px';

    amgui.createLabel({
        caption: 'Name: ',
        fontSize: '18px',
        // display: 'block',
        parent: this._deContent
    });

    this._inpName = document.createElement('input');
    this._inpName.type = 'text';
    this._inpName.value = this.name;
    this._inpName.style.display = 'inline-block';
    this._inpName.style.width = '245px';
    this._inpName.style.fontSize = '14px';
    this._inpName.style.fontFamily = amgui.FONT_FAMILY;
    this._inpName.style.background = 'none';
    this._inpName.style.border = 'none';
    this._inpName.style.marginBottom = '12px';
    this._inpName.style.color = amgui.color.text;
    this._inpName.addEventListener('change', this._onChangeName);
    this._deContent.appendChild(this._inpName);

    amgui.createLabel({
        caption: 'Selectors',
        fontSize: '18px',
        display: 'block',
        parent: this._deContent
    });

    this._deSelectorCont = document.createElement('div');
    this._deSelectorCont.style.width = '100%';
    this._deContent.appendChild(this._deSelectorCont);

    amgui.createIconBtn({
        icon: 'plus',
        display: 'inline-block',
        onClick: this._addSelector.bind(this, ''),
        parent: this._deContent
    });

    amgui.createIconBtn({
        icon: 'code',
        display: 'inline-block',
        onClick: function () {am.dialogs.featureDoesntExist.show();},
        parent: this._deContent,
        tooltip: 'select from options'
    });

    amgui.createLinebreak({
        parent:this._deContent
    });

    amgui.createLabel({
        caption: 'Fill mode: ',
        fontSize: '18px',
        parent: this._deContent
    });
    this._deFill = amgui.createLabel({
        parent: this._deContent
    });
    amgui.bindDropdown({
        deTarget: this._deFill,
        deMenu: amgui.createDropdown({
            options: ['none', 'forwards', 'backwards', 'both'],
            onSelect: this._onSelectFill,
        }),
        menuParent: this._deContent,
    });

    amgui.createLinebreak({
        parent: this._deContent
    });

    amgui.createLabel({
        fontSize: '18px',
        caption: 'Iterations: ',
        parent: this._deContent
    });

    this._inpIterations = document.createElement('input');
    this._inpIterations.type = 'number';
    this._inpIterations.step = 1;
    this._inpIterations.min = 0;
    this._inpIterations.max = 999999999999;
    this._inpIterations.style.fontSize = '14px';
    this._inpIterations.style.fontFamily = amgui.FONT_FAMILY;
    this._inpIterations.style.background = 'none';
    this._inpIterations.style.border = 'none';
    this._inpIterations.style.marginBottom = '12px';
    this._inpIterations.style.color = amgui.color.text;
    this._inpIterations.addEventListener('change', this._onChangeIterations);
    this._deContent.appendChild(this._inpIterations);
};

p._addSelector = function(value) {

    var selector = {
        value: value,
    };
    this._selectors.push(selector);

    var height = 23;

    selector.domElem = document.createElement('div');
    selector.domElem.style.display = 'flex';
    selector.domElem.style.height = height + 'px';
    selector.domElem.style.paddingLeft = '2px';
    selector.domElem.style.margin = '1px 0';
    selector.domElem.style.background = amgui.color.bg2;
    this._deSelectorCont.appendChild(selector.domElem);

    var inp = document.createElement('input');
    inp.type = 'text';
    inp.value = value;
    inp.placeholder = 'selector';
    inp.style.width = '245px';
    inp.style.height = height + 'px';
    inp.style.fontSize = '14px';
    inp.style.fontFamily = amgui.FONT_FAMILY;
    inp.style.flex = '1';
    inp.style.background = 'none';
    inp.style.border = 'none';
    inp.style.color = amgui.color.text;
    selector.domElem.appendChild(inp);

    inp.addEventListener('change', function () {

        selector.value = inp.value;

        this.emit('changeSelectors', this.selectors);
    }.bind(this));

    var btnDel = amgui.createIconBtn({
        icon: 'cancel',
        height: height,
        display: 'inline-block',
        onClick:this._removeSelector.bind(this, selector),
        parent: selector.domElem
    });
    btnDel.style.visibility = 'hidden';

    selector.domElem.addEventListener('mouseenter', function () {
        btnDel.style.visibility = 'visible';
    });
    selector.domElem.addEventListener('mouseleave', function () {
        btnDel.style.visibility = 'hidden';
    });
};

p._removeSelector = function (selector) {

    this._selectors.splice(this._selectors.indexOf(selector), 1);

    selector.domElem.parentNode.removeChild(selector.domElem);
};

module.exports = new DialogSequOptions();

},{"../../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\script.player.mst":[function(require,module,exports){
module.exports = "function () {\n\n    var player,\n        animation,\n        isInited = false,\n        animations = [],\n        paramKeys = {{{paramKeys}}},\n        options = {{{options}}},\n        elems = document.querySelectorAll('{{{selectors}}}');\n\n    for (var i = 0; i < elems.length; ++i) {\n        for (var j = 0; j < paramKeys.length; ++j) {\n\n            animations.push(new Animation(elems[i], paramKeys[j], options));\n        }\n    }\n\n    animation = new AnimationGroup(animations);\n\n    return {\n\n        play: function () {\n\n            if (!isInited) {\n\n                player = document.timeline.play(animation);\n                isInited = true;\n            }\n            else {\n                player.play();\n            }\n        },\n        pause: function () {\n\n            if (!player) {\n                return;\n            }\n\n            player.pause();\n        },\n        seek: function (time) {\n\n            if (!player) {\n                return;\n            }\n\n            player.currentTime = time;\n        }\n    };\n}";

},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\css\\uncalc.js":[function(require,module,exports){
'use strict';

var rx = /^calc\((.*?)\)$/;
    
module.exports = function uncalc (value) {

    if (typeof(value) === 'string' && value.indexOf('calc(') !== -1) {

        var m = rx.exec(value);
        return m ? '( ' + m[1] + ' )' : value;
    }
    else {

        return value;
    }
};
},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\javascript\\Interval.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var amgui = require('../../amgui');

function Interval(opt) {

    EventEmitter.call(this);

    this._lineH =  21;
    this._start = 0;
    this._end = am.timeline.length;

    this._onDragResize = this._onDragResize.bind(this);
    this._onDragMove = this._onDragMove.bind(this);
    this._onChangeTime = this._onChangeTime.bind(this);

    this._createDomElem();
    this._refreshDomElem();

    am.timeline.on('changeTime', this._onChangeTime);

    if (opt) {
        this.useSave(opt);
    }
}

inherits(Interval, EventEmitter);
var p = Interval.prototype;









Object.defineProperties(p, {

    start: {
        set: function (v) {

            if (this._start === v) return;

            this._start = v;

            this._refreshDomElem();
        },
        get: function () {
            
            return this._start;
        }
    },
    end: {
        set: function (v) {

            if (this._end === v) return;

            this._end = v;

            this._refreshDomElem();
        },
        get: function () {
            
            return this._end;
        }
    },
});





p.getSave = function () {

    var save = {
        start: this.start,
        end: this.end,
    };

    return save;
};

p.useSave = function(save) {

    if ('start' in save) this.start = save.start;
    if ('end' in save) this.end = save.end;
};












p._onChangeTime = function () {

    this._refreshDomElem();
};

p._onDragResize = function () {

    //TODO
};

p._onDragMove = function () {

    //TODO
};








p._refreshDomElem = function () {

    this.domElem.style.left = this.start * am.timeline.timescale + 'px';
    this.domElem.style.width = (this.end - this.start) * am.timeline.timescale + 'px';
};








p._createDomElem = function () {

    var de = document.createElement('div');
    de.style.width = '100%';
    de.style.height = this._lineH + 'px';
    de.style.background = 'blue';
    de.style.position = 'relative';

    createHandler('left');
    createHandler('right');

    this.domElem = de;

    amgui.bindDropdown({
        asContextMenu: true,
        deTarget: de,
        deMenu: amgui.createDropdown({
            options: [
                {text: 'split here'},
                {text: 'remove'}
            ]
        }),
        onSelect: function () {
            //TODO
            am.dialogs.featureDoesntExist.show();
        }
    });

    function createHandler(side) {

        var handler = document.createElement('div');
        handler.style.position = 'absolute';
        handler.style.top = '0px';
        handler.style[side] = '0px';
        handler.style.height = '100%';
        handler.style.width = '3px';
        handler.style.cursor = 'ew-resize';
        handler.style.pointerEvents = 'auto';
        de.appendChild(handler);
    }
};



p.dispose = function () {

    //TODO
};

module.exports = Interval;

},{"../../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\javascript\\IntervalScript.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var dialogScriptEditor = require('./dialogScriptEditor');
var amgui = require('../../amgui');
var Interval = require('./Interval');

function IntervalScript(opt) {

    EventEmitter.call(this);

    this._lineH =  21;
    this._script =  '/**/';
    this._intervals = [];

    this._onClickOpenScript = this._onClickOpenScript.bind(this);
    this._onChangeScript = this._onChangeScript.bind(this);
    this._onDblclickKeyline = this._onDblclickKeyline.bind(this);

    this.deOptions = this._createParameterOptions();
    this.deKeyline = this._createBoundsLine();

    this._addInterval();

    this.deKeyline.addEventListener('dblclick', this._onDblclickKeyline);

    if (opt) {
        this.useSave(opt);
    }
}

inherits(IntervalScript, EventEmitter);
var p = IntervalScript.prototype;









Object.defineProperties(p, {

    height: {
        get: function () {
            
            return this._lineH;
        }
    },
    script: {
        set: function (v) {

            v = v || '';

            if (this._script === v) return;

            this._script = v;
        },
        get: function () {

            return this._script;
        }
    }
});





p.getSave = function () {

    var save = {
        name: this.name,
        script: JSON.stringify(this.script).slice(1, -1).replace(/'/g, '\\\''),
        intervals: [],
    };

    this._intervals.forEach(function (interval) {

        save.intervals.push(interval.getSave());
    });

    return save;
};

p.useSave = function(save) {

    if ('name' in save) this.name = save.name;
    if ('script' in save) this.script = save.script;
    if ('intervals' in save) {

        while (this._intervals.length) {

            this._removeInterval(this._intervals[0]);
        }

        save.intervals.forEach(function (intervalSave) {

            this._addInterval(intervalSave);
        }, this);
    }
};

p.isInsideBounds = function (time) {

    return this._intervals.some(function (interval) {

        if (interval.start <= time && interval.end >= time) {

            return true;
        }
    });
};

p.runScript = function () {

    (new Function(this.script))();//TODO hack!!!
};

p.editScript = function () {

    dialogScriptEditor.show({

        script: this.script,
        onChangeScript: function (script) {

            this.script = script;
        }
    });
};









p._addInterval = function (interval) {

    if (!(interval instanceof Interval)) {

        interval = new Interval(interval);
    }

    this.deKeyline.appendChild(interval.domElem);

    this._intervals.push(interval);
};

p._removeInterval = function (interval) {

    var idx = this._intervals.indexOf(interval);

    if (idx === -1) {
        return;
    }

    this._intervals.splice(idx, 1);

    interval.domElem.parentNode.removeChild(interval.domElem);
    interval.dispose();
};








p._onDeleteKey = function (key) {

    this.removeKey(key);
};

p._onClickOpenScript = function () {

    dialogScriptEditor.show({
        script: this.script,
        onChangeScript: this._onChangeScript,
    });
};

p._onChangeScript = function (script) {

    this.script = script;
};

p._onDblclickKeyline = function () {

    this.editScript();
};














p._createBoundsLine = function () {

    var de = document.createElement('div');
    de.style.width = '100%';
    de.style.height = this._lineH + 'px';
    de.style.background = 'grey';
    de.style.position = 'relative';

    return de;
};


p._createParameterOptions = function () {

    var de = document.createElement('div');
    de.style.display = 'flex';
    de.style.width = '100%';
    de.style.height = this._lineH + 'px';
    de.style.background = 'linear-gradient(to bottom, blue 18%,darkblue 96%)';

    var space = document.createElement('div');
    space.style.display = 'inline-block';
    space.style.flex = '1';
    space.style.pointerEvents = 'none';
    de.appendChild(space);

    this._btnOpenScript = amgui.createIconBtn({
        icon: 'code',
        height: this._baseH,
        onClick: this._onClickOpenScript,
        parent: de
    });

    this._btnEdit = amgui.createIconBtn({
        icon: 'wrench',
        height: this._baseH,
        parent: de
    });

    amgui.bindDropdown({
        deTarget: this._btnEdit,
        deMenu: amgui.createDropdown({
            options: [
                {text: 'merge'},
                {text: 'split'},
                {text: 'end here'},
                {text: 'start here'},
                {text: 'add', icon: 'plus'},
                {text: 'remove', icon: 'minus'},
            ]
        }),
        onSelect: function () {
            am.dialogs.featureDoesntExist.show();
        }
    });

    amgui.bindDropdown({
        asContextMenu: true,
        deTarget: de,
        deMenu: amgui.createDropdown({
            options: [
                {text: 'move up', onSelect: this.emit.bind(this, 'move', this, -1)},
                {text: 'move down', onSelect: this.emit.bind(this, 'move', this, 1)},
                {text: 'delete', onSelect: this.emit.bind(this, 'delete', this)},
            ]
        })
    });

    return de;
};

p.dispose = function () {

    //TODO
};

module.exports = IntervalScript;

},{"../../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","./Interval":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\javascript\\Interval.js","./dialogScriptEditor":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\javascript\\dialogScriptEditor.js","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\javascript\\JsSequence.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var amgui = require('../../amgui');
var IntervalScript = require('./IntervalScript');
var MomentScript = require('./MomentScript');
var mstPlayer = require('./script.player.mst');
var dialogSequOptions = require('./dialogSequOptions');

function JsSequence(opt) {

    EventEmitter.call(this);

    this._intervalScripts = [];
    this._momentScripts = [];
    this._baseH = 21;
    this._isShowingIntervalScrips = false;
    this._isHidingSelectedElems = false;
    this._isPlaying = false;

    this._onSelectClick = this._onSelectClick.bind(this);
    this._onChangeTime = this._onChangeTime.bind(this);
    this._onChangeIntervalScript = this._onChangeIntervalScript.bind(this);
    this._onDeleteIntervalScript = this._onDeleteIntervalScript.bind(this);
    this._onMoveIntervalScript = this._onMoveIntervalScript.bind(this);
    this._onClickAddIntervalScript = this._onClickAddIntervalScript.bind(this);
    this._onClickTgglShowIntervalScripts = this._onClickTgglShowIntervalScripts.bind(this);
    this._onClickTgglMomentScript = this._onClickTgglMomentScript.bind(this);
    this._onClickEditMomentScript = this._onClickEditMomentScript.bind(this);
    this._onClickName = this._onClickName.bind(this);
    this._onChangeName = this._onChangeName.bind(this);
    this._onChangeName = this._onChangeName.bind(this);
    this._animPlay = this._animPlay.bind(this);

    this.deOptions = document.createElement('div');
    this.deKeys = document.createElement('div');

    this._deHeadOptinos = this._createHeadOptions();
    this._deHeadKeyline = amgui.createKeyline({});
    this.deKeys.appendChild(this._deHeadKeyline);

    am.timeline.on('changeTime', this._onChangeTime);
    this.deOptions.addEventListener('click', this._onSelectClick);
    this.deKeys.addEventListener('click', this._onSelectClick);

    if (opt) {
        this.useSave(opt);
    }
}

inherits(JsSequence, EventEmitter);
var p = JsSequence.prototype;

p.type = 'js_sequ_type';






Object.defineProperties(p, {

    height: {

        get: function () {

            var ret = this._baseH;

            if (this._isShowingIntervalScrips) {

                this._intervalScripts.forEach(function (intervalScript) {

                    ret += intervalScript.height;
                });
            }

            return ret;
        }
    },

    name: {
        set: function (v) {

            if (v === this._name) return;

            this._name = v || 'unnamed';
            this._deName.textContent = this._name;
        },
        get: function () {

            return this._name;
        }
    }
});






p.getSave = function () {

    var save = {
        name: this.name,
        intervalScripts: [],
        momentScripts: [],
        isShowingIntervalScripts: this._isShowingIntervalScrips,
    };

    this._intervalScripts.forEach(function (intervalScript) {

        save.intervalScripts.push(intervalScript.getSave());
    });

    this._momentScripts.forEach(function (momentScript) {

        save.momentScripts.push(momentScript.getSave());
    });

    return save;
};

p.useSave = function (save) {

    if (!save) {
        return;
    }

    this._selectors = save.selectors || [];

    if ('name' in save) this.name = save.name;

    if (save.intervalScripts) {

        save.intervalScripts.forEach(this.addIntervalScript, this);
    }

    if (save.momentScripts) {

        save.momentScripts.forEach(this.addMomentScript, this);
    }

    if (save.isShowingIntervalScripts) {

        this._showIntervalScripts();
    }
};

p.getScript = function () {//TODO

    var momentScripts = [], intervalScripts = [];

    this._intervalScripts.forEach(function (intervalScript) {

    });

    var code = Mustache.render(mstPlayer, {
        momentScripts: JSON.stringify(momentScripts),
        intervalScripts: JSON.stringify(intervalScripts)
    });

    return 'function () {/*TODO*/}';
};

p.addIntervalScript = function (opt, skipHistory) {

    opt = opt || {};

    var intervalScript = new IntervalScript(opt);

    if (!skipHistory) {
        am.history.save([this._removeIntervalScript, this, intervalScript, true],
            [this.addIntervalScript, this, opt, true]);
    }
    
    this._intervalScripts.push(intervalScript);
    intervalScript.on('change', this._onChangeIntervalScript);
    intervalScript.on('delete', this._onDeleteIntervalScript);
    intervalScript.on('move', this._onMoveIntervalScript);

    this._refreshIntervalScriptOrdering();
    this.emit('changeHeight', this);

    return intervalScript;
};

p.removeIntervalScript = function (intervalScript, skipHistory) {

    if (!skipHistory) {
        am.history.save([this.addIntervalScript, this, intervalScript, true],
            [this.removeIntervalScript, this, intervalScript, true]);
    }

    var idx = this._intervalScripts.indexOf(intervalScript);

    if (idx === -1) {
        return;
    }

    this._intervalScripts.splice(idx, 1);

    intervalScript.removeListener('change', this._onChangeIntervalScript);
    intervalScript.removeListener('delete', this._onDeleteIntervalScript);
    intervalScript.removeListener('move', this._onMoveIntervalScript);

    $(intervalScript.deOptions).remove();
    $(intervalScript.deKeyline).remove();
};

p.moveIntervalScript = function (intervalScript, way) {

    var idx = this._intervalScripts.indexOf(intervalScript);

    this._intervalScripts.splice(idx, 1);
    idx = Math.min(this._intervalScripts.length, Math.max(0, idx + way));
    this._intervalScripts.splice(idx, 0, intervalScript);

    this._refreshIntervalScriptOrdering();
};


p.addMomentScript = function (opt, skipHistory) {
    
    var ms = this.getMomentScript(opt.time);

    if (ms) {

        if ('script' in opt) {

            if (!skipHistory) {
                am.history.saveChain(ms, [this.addMomentScript, this, ms, true], [this.addMomentScript, this, opt, true]);
            }

            ms.script = opt.script;
        }
    }
    else {

        ms = new MomentScript(_.extend({deKeyline: this._deHeadKeyline}, opt));

        // ms.on('changeTime', this._onChangeKeyTime);//TODO
        // ms.on('delete', this._onDeleteKey);//TODO

        this._momentScripts.push(ms);

        if (!skipHistory) {
            am.history.closeChain(ms);
            am.history.save([this.removeMomentScript, this, opt.time, true], [this.addMomentScript, this, opt, true]);
        }
    }

    this._refreshTgglMomentScript();

    this.emit('change');

    return ms;
};

p.removeMomentScript = function (ms, skipHistory) {

    if (typeof(ms) === 'number') {

        ms = this.getMomentScript(ms);
    }

    var idx = this._momentScripts.indexOf(ms);

    if (idx === -1) {

        return;
    }

    if (!skipHistory) {
        am.history.save([this.addMomentScript, this, ms, true],
            [this.removeMomentScript, this, ms, true]);
    }

    this._momentScripts.splice(idx, 1);

    ms.dispose();

    // ms.removeListener('changeTime', this._onChangeKeyTime);//TODO
    // ms.removeListener('delete', this._onDeleteKey);//TODO

    this._refreshTgglMomentScript();

    this.emit('change');
};

p.getMomentScript = function (time) {

    return this._momentScripts.find(function(ms) {

        return ms.time === time;
    });
};


p.select = function (opt) {

    opt = opt || {};

    if (this._isSelected) return;
    this._isSelected = true;

    this.deHighlight.style.opacity = 1;

    this.emit('select', this);
};

p.deselect = function () {

    if (!this._isSelected) return;
    this._isSelected = false;

    this.deHighlight.style.opacity = 0;
};

p.renderTime = function (time) {

    //TODO
};

p.play = function () {

    this._isPlaying = true;

    this._animPlay();
};

p.pause = function () {

    this._isPlaying = false;

    window.cancelAnimationFrame(this._animPlayRafid);
};

p.getMagnetPoints = function () {

    var times = [];

    this._momentScripts.forEach(function (momentScript) {

        times.push(momentScript.time);
    });

    return times;
};










p._animPlay = function () {

    this._animPlayRafid = window.requestAnimationFrame(this._animPlay);
    
    var currTime = am.timeline.currTime, 
        prevTime = this.prevRenderTime;

    this._momentScripts.forEach(function (momentScript) {

        if (momentScript.time > prevTime && momentScript.time <= currTime) {

            momentScript.runScript();
        }
    });

    this._intervalScripts.forEach(function (intervalScript) {

        if (intervalScript.isInsideBounds(currTime)) {

            intervalScript.runScript();
        }
    });

    this.prevRenderTime = currTime;
};

p._showIntervalScripts = function () {

    if (this._isShowingIntervalScrips) return;
    this._isShowingIntervalScrips = true;

    this._tgglShowIntervalScripts.setToggle(true);
    this.emit('changeHeight', this);
};

p._hideIntervalScripts = function () {

    if (!this._isShowingIntervalScrips) return;
    this._isShowingIntervalScrips = false;

    this._tgglShowIntervalScripts.setToggle(false);
    this.emit('changeHeight', this);
};








p._onSelectClick = function () {

    this.select();
};

p._onChangeTime = function () {

    if (this._isPlaying) {
        return;
    }

    this._refreshTgglMomentScript();
};

p._onChangeIntervalScript = function () {

    this.renderTime();

    this.emit('change');
};

p._onDeleteIntervalScript = function (intervalScript) {

    this.removeIntervalScript(intervalScript);
};

p._onMoveIntervalScript = function (intervalScript, way) {

    this.moveIntervalScript(intervalScript, way);
};

p._onClickTgglMomentScript = function () {

    var time = am.timeline.currTime,
        momentScript = this.getMomentScript(time);
    
    if (momentScript) {

        this.removeMomentScript(momentScript);
    }
    else {
        this.addMomentScript({time: time});
    }

    this._refreshTgglMomentScript();
};

p._onClickEditMomentScript = function () {

    var momentScript = this.getMomentScript(am.timeline.currTime);

    if (momentScript) {

        momentScript.editScript();
    }
};

p._onClickTgglShowIntervalScripts = function () {

    if (this._isShowingIntervalScrips) {
        this._hideIntervalScripts   ();
    }
    else {
        this._showIntervalScripts();
    }
};

p._onClickAddIntervalScript = function () {

    this.addIntervalScript();
};

p._onClickName = function () {

    dialogSequOptions.show({
        name: this._name,
        onChangeName: this._onChangeName,
    });
};

p._onChangeName = function (name) {

    this.name = name;
};













p._refreshTgglMomentScript = function () {

    var momentScript = this.getMomentScript(am.timeline.currTime);

    this._tgglMomentScript.setToggle(!!momentScript);
    this._tgglEditMomentScript.setToggle(!!momentScript);
};

p._refreshIntervalScriptOrdering = function () {

    this._intervalScripts.forEach(function (intervalScript) {

        this.deOptions.appendChild(intervalScript.deOptions);
        this.deKeys.appendChild(intervalScript.deKeyline);
    }, this);
};











p._createHeadOptions = function (){

    var de = document.createElement('div');
    de.style.position = 'relative';
    de.style.width = '100%';
    de.style.display = 'flex';
    de.style.height = this._baseH + 'px';
    de.style.background = 'linear-gradient(to bottom, blue 18%,darkblue 96%)';
    this.deOptions.appendChild(de);

    this.deHighlight = document.createElement('div');
    this.deHighlight.style.display = 'inline-block';
    this.deHighlight.style.width = '2px';
    this.deHighlight.style.height = this._baseH + 'px';
    this.deHighlight.style.background = 'gold';
    this.deHighlight.style.opacity = 0;
    de.appendChild(this.deHighlight);

    this._tgglShowIntervalScripts = amgui.createToggleIconBtn({
        iconOn: 'angle-down',
        iconOff: 'angle-right',
        height: this._baseH,
        onClick: this._onClickTgglShowIntervalScripts,
        parent: de
    });

    this._deName = amgui.createLabel({caption: this._name, parent: de});
    this._deName.style.height = this._baseH  + 'px';
    this._deName.style.cursor = 'pointer';
    this._deName.addEventListener('click', this._onClickName);

    var deNameIcon = amgui.createIcon({
        icon: 'cog',
        parent: de
    });
    deNameIcon.style.display = 'none';
    this._deName.addEventListener('mouseenter', function () {deNameIcon.style.display = 'inline-block';});
    this._deName.addEventListener('mouseleave', function () {deNameIcon.style.display = 'none';});

    var space = document.createElement('div');
    space.style.display = 'inline-block';
    space.style.flex = '1';
    space.style.pointerEvents = 'none';
    de.appendChild(space);

    this._btnAddIntervalScript = amgui.createIconBtn({
        icon: 'plus',
        height: this._baseH,
        defaultToggle: false,
        onClick: this._onClickAddIntervalScript,
        parent: de
    });

    this._tgglEditMomentScript = amgui.createToggleIconBtn({
        icon: 'code',
        height: this._baseH,
        onClick: this._onClickEditMomentScript,
        changeColor: true,
        parent: de
    });

    this._tgglMomentScript = amgui.createToggleIconBtn({
        iconOn: 'circle',
        iconOff: 'circle-empty',
        height: this._baseH,
        onClick: this._onClickTgglMomentScript,
        changeColor: true,
        parent: de
    });
    this._refreshTgglMomentScript();

    amgui.bindDropdown({
        asContextMenu: true,
        deTarget: de,
        deMenu: amgui.createDropdown({
            options: [
                {text: 'move up', onSelect: this.emit.bind(this, 'move', this, -1)},
                {text: 'move down', onSelect: this.emit.bind(this, 'move', this, 1)},
                {text: 'delete', onSelect: this.emit.bind(this, 'delete', this)},
            ]
        })
    });

    return de;
};

p.isOwnedDomElem = function () {

    return false;
};

p.dispose = function () {

    am.timeline.removeListener('changeTime', this._onChangeTime);

    //TODO
};

module.exports = JsSequence;





},{"../../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","./IntervalScript":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\javascript\\IntervalScript.js","./MomentScript":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\javascript\\MomentScript.js","./dialogSequOptions":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\javascript\\dialogSequOptions.js","./script.player.mst":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\javascript\\script.player.mst","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\javascript\\MomentScript.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var dialogScriptEditor = require('./dialogScriptEditor');
var amgui = require('../../amgui');

function MomentScript(opt) {

    EventEmitter.call(this);
    
    this._time =  0;
    this._script =  '';
    this._deKeyline = opt.deKeyline;

    this._onChangeDeTime = this._onChangeDeTime.bind(this);
    this._onSelectDropdown = this._onSelectDropdown.bind(this);
    this._onChangeTape = this._onChangeTape.bind(this);
    this._onDblclickKey = this._onDblclickKey.bind(this);

    this.domElem = this._deKeyline.addKey({
        timescale: am.timeline.timescale,
        time: this.time,
        ease: 'none'
    });


    this._deMenu = amgui.createDropdown({
        options: ['script', 'delete']
    });
    this._deMenu.addEventListener('select', this._onSelectDropdown);

    this.domElem.addEventListener('changeTime', this._onChangeDeTime);
    am.timeline.on('changeTape', this._onChangeTape);

    amgui.bindDropdown({
        deTarget: this.domElem,
        deMenu: this._deMenu,
        asContextMenu: true
    });

    this.domElem.addEventListener('dblclick', this._onDblclickKey);

    if (opt) {
        this.useSave(opt);
    }
}

inherits(MomentScript, EventEmitter);
var p = MomentScript.prototype;

Object.defineProperties(p, {

    time: {
        set: function (v) {

            if (!Number.isFinite(v) || this._time === v) return;

            this._time = v;

            this.domElem.setTime(this._time);
        },
        get: function () {

            return this._time;
        }
    },
    script: {
        set: function (v) {

            if (this._script === v) return;

            this._script = v;
        },
        get: function () {

            return this._script;
        }
    }
});


p.getSave = function () {

    return {
        script: JSON.stringify(this.script).slice(1, -1).replace(/'/g, '\\\''),
        time: this.time,
    };
};

p.useSave = function (save) {

    if ('script' in save) this.script = save.script;
    if ('time' in save) this.time = save.time;
};

p.runScript = function () {

    (new Function(this.script))();//TODO hack!!!
};

p.editScript = function () {

    dialogScriptEditor.show({

        script: this.script,
        onChangeScript: function (script) {

            this.script = script;
        }
    });
};






p._onChangeDeTime = function (e) {

    this.time = e.detail.time;

    this.emit('changeTime');
};

p._onSelectDropdown = function (e) {
    
    var selection = e.detail.selection;

    if (selection === 'delete') {

        this.emit('delete', this);
    }
    else if (selection === 'edit script') {

        this.editScript();
    }
};

p._onChangeTape = function () {

    this.domElem.setTimescale(am.timeline.timescale);
};

p._onDblclickKey = function () {

    this.editScript();
};




p.dispose = function () {

    this.domElem.removeEventListener('changeTime', this._onChangeDeTime);
    this._deMenu.removeEventListener('select', this._onSelectDropdown);
    am.timeline.removeListener('changeTape', this._onChangeTape);

    this.domElem.remove();
    if (this._deMenu.parentNode) this._deMenu.parentNode.removeChild(this._deMenu); 
};

module.exports = MomentScript;

},{"../../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","./dialogScriptEditor":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\javascript\\dialogScriptEditor.js","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\javascript\\dialogScriptEditor.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var amgui = require('../../amgui');

function DialogScriptEditor () {

    EventEmitter.call(this);

    this._name = '';
    this._selectors = [];

    this._onClickOk = this._onClickOk.bind(this); 
    this._onChangeScript = this._onChangeScript.bind(this);
}

inherits(DialogScriptEditor, EventEmitter);
var p = DialogScriptEditor.prototype;



Object.defineProperties(p, {

    script: {
        set: function (v) {

            v = v || '';

            if (this._script === v) {
                return;
            }

            this._script = v;

            if (this._cm && this._cm.getValue() !== v) {
                
                this._cm.setValue(v);
            }
            this.emit('changeScript', v);
        },
        get: function () {

            return this._script;
        }
    }
});

p.show = function (opt) {

    opt = opt || {};

    this._createDialog();

    if ('script' in opt) this.script = opt.script;

    this.domElem.showModal();

    if (this._cm) {
        this._cm.refresh();
    }

    if ('onChangeScript' in opt) this.on('changeScript', opt.onChangeScript);
};

p.hide = function () {

    this.domElem.close();

    this.removeAllListeners('changeScript');
};

p._createDialog = function () {

    if (this._isDialogCreated) return;
    this._isDialogCreated = true;

    this._createContent();
    
    this.domElem = amgui.createDialog({
        title: 'Script',
        content: this._deContent,
        parent: am.deDialogCont,
        buttons: ['ok'],
    });

    this.domElem.addEventListener('click_ok', this._onClickOk);
};

p._onClickOk = function () {

    this.hide();
};

p._onChangeScript = function () {

    this.script = this._cm.getValue();
};


p._createContent = function () {

    this._deContent = document.createElement('div');
    this._deContent.style.width = '480px';
    this._deContent.style.height = '330px';
    this._deContent.style.padding = '30px 12px';

    this._textarea = document.createElement('textarea');
    this._deContent.appendChild(this._textarea);

    amgui.callOnAdded(this._textarea, function () {

        this._cm = new CodeMirror.fromTextArea(this._textarea, {
            lineNumbers: true,
            theme: 'pastel-on-dark',
            mode: 'javascript'
        });
        
        this._cm.setValue(this.script);
        this._cm.on('change', this._onChangeScript);
    }, this);
};

module.exports = new DialogScriptEditor();

},{"../../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\javascript\\dialogSequOptions.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var amgui = require('../../amgui');

function DialogSequOptions () {

    EventEmitter.call(this);

    this._name = '';
    this._selectors = [];

    this._onClickOk = this._onClickOk.bind(this); 
    this._onChangeName = this._onChangeName.bind(this);
}

inherits(DialogSequOptions, EventEmitter);
var p = DialogSequOptions.prototype;



Object.defineProperties(p, {

    name: {
        set: function (v) {

            if (this._name === v) {
                return;
            }

            this._name = v;
            this._inpName.value = v;
            this.emit('changeName', v);
        },
        get: function () {
            return this._name;
        }
    },
});

p.show = function (opt) {

    opt = opt || {};

    this._createDialog();

    if ('name' in opt) this.name = opt.name;

    if ('onChangeName' in opt) this.on('changeName', opt.onChangeName);

    this.domElem.showModal();
};

p.hide = function () {

    this.domElem.close();

    this.removeAllListeners('changeName');
};

p._createDialog = function () {

    if (this._isDialogCreated) return;
    this._isDialogCreated = true;

    this._createContent();
    
    this.domElem = amgui.createDialog({
        title: 'Sequence',
        content: this._deContent,
        parent: am.deDialogCont,
        buttons: ['ok'],
    });

    this.domElem.addEventListener('click_ok', this._onClickOk);
};

p._onClickOk = function () {

    this.hide();
};

p._onChangeName = function () {

    this.name = this._inpName.value;
};


p._createContent = function () {

    this._deContent = document.createElement('div');
    this._deContent.style.width = '330px';
    this._deContent.style.padding = '30px 12px';

    amgui.createLabel({
        caption: 'Name',
        fontSize: '18px',
        display: 'block',
        parent: this._deContent
    });

    this._inpName = document.createElement('input');
    this._inpName.type = 'text';
    this._inpName.value = this.name;
    this._inpName.style.width = '245px';
    this._inpName.style.fontSize = '14px';
    this._inpName.style.fontFamily = amgui.FONT_FAMILY;
    this._inpName.style.background = 'none';
    this._inpName.style.border = 'none';
    this._inpName.style.marginBottom = '12px';
    this._inpName.style.color = amgui.color.text;
    this._inpName.addEventListener('change', this._onChangeName);
    this._deContent.appendChild(this._inpName);
};

module.exports = new DialogSequOptions();

},{"../../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\javascript\\jsModule.js":[function(require,module,exports){
'use strict';

var JsSequence = require('./JsSequence');

exports.init = function () {

    am.registerSequenceType(JsSequence, JsSequence.prototype.type);
};

},{"./JsSequence":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\javascript\\JsSequence.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\modules\\javascript\\script.player.mst":[function(require,module,exports){
module.exports = " function () {\n\n    return function () {\n\n        var currTime = 0,\n            prevTime = 0,\n            speed = 0;\n        \n        this.startSystemTime = 0;\n        this.momentFunctions = [{{{momentFunctions}}}];\n        this.intervalFunctions = [{{{intervalFunctions}}}];\n\n        this.step = function(time) {\n\n            this.stepRafId = requestAnimationFrame(this.step);\n            \n            prevTime = currTime;\n            currTime = performance.now();\n\n            this.momentFunctions.forEach(function (fnData) {\n\n                if (fnData.time > prevTime && fnData.time <= currTime) {\n\n                    fnData.fn();\n                }\n            });\n\n            this.intervalFunctions.forEach(function (fnData) {\n\n                for (var i = 0; i < fnData.bounds; i += 2) {\n\n                    if (fnData.bounds[i] > prevTime && fnData.bounds[i+1] <= currTime) {\n\n                        fnData.fn();\n                    }\n                }\n            });\n\n        }.bind(this);\n\n        var ret = {};\n\n        ret.play = function () {\n\n            this.step();\n\n        }.bind(this);\n\n        ret.pause = function () {\n\n            cancelAnimationFrame(this.stepRafId);\n\n        }.bind(this);\n\n        ret.seek = function (time) {\n\n            currTime = time;\n            prevTime = time;\n\n        }.bind(this);\n\n    }.call({});\n};";

},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\qsgen.js":[function(require,module,exports){
'use strict';

var EXATTR = ['id', 'class', 'style'];

function generate(de, root) {

    root = root || document;

    var deCurr = de,
        rootCurr = root, 
        qsCurr, qsParent = '';

    while (true) {

        do {
            qsCurr = gen(deCurr, rootCurr);
        }
        while(!qsCurr && 
            deCurr.parentNode !== rootCurr &&
            (deCurr = deCurr.parentNode));

        if (!qsCurr) {

            if (deCurr.parentNode === rootCurr) {

                qsCurr = '> ' + deCurr.tagName + ':nth-child(' +
                    (Array.prototype.indexOf.call(rootCurr.childNodes, deCurr) + 1) + ')';
            }
            else {
                return; //can't find unique query selector
            }
        }

        qsParent += (qsParent ? ' ' : '') + qsCurr;

        if (deCurr === de) {

            return qsParent;
        }
        else {
            qsCurr = undefined;
            rootCurr = deCurr;
            deCurr = de;
        }
    }
}

function gen(de, root) {


    var singles, selectors, matches = [];

    singles = selectors = [de.tagName].concat(
        possibleIds(de),
        possibleClasses(de, i),
        possibleAttributes(de, i)
    );

    for (var i = 0; i < 5; ++i) {

        selectors.forEach(function (selector) {

            if (root.querySelectorAll(selector).length === 1) {
                matches.push(selector);
            }
        });

        if (matches.length) {

            return matches[0];
        }
        else {
            selectors = combine(selectors, singles);
        }
    }
}

function possibleIds(de) {

    return de.id ? ['#' + CSS.escape(de.id)] : [];
}

function possibleClasses(de, max) {

    return Array.prototype.slice.call(de.classList, 0)
        .map(function (className) {
            return '.' + CSS.escape(className);
        });
}

function possibleAttributes(de) {

    return Array.prototype.slice.call(de.attributes, 0)
        .filter(function(attr) {
            return EXATTR.indexOf(attr.name) === -1;
        })
        .map(function (attr) {
            return '[' + CSS.escape(attr.name) + (attr.value ? '="'+attr.value+'"': '') + ']';
        });
}

// function variate(_list, length) {

//     return step(_list, 2);

//     function step(list, back) {

//         var combined = combine(attributes, list);
//         return list.concat(back === 0 ? combined : step(combined, --back));
//     }
// }

function combine(sourceA, sourceB) {

    var combined = [];

    sourceA.forEach(function (a) {
        sourceB.forEach(function (b) {
            if (a.indexOf(b) === -1 && b.indexOf(a) === -1 &&
                '#.[:'.indexOf(b.charAt(0)) !== -1) 
            {
                combined.push(a + b);
            }
        });
    });

    return combined;
}

module.exports = generate;

},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\timeline\\Timebar.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var amgui = require('../amgui');
var decorTimebarNavigator = require('./decorTimebarNavigator');

function Timebar(opt) {

    EventEmitter.call(this);

    opt = opt || {};

    this._start = opt.start || 0;
    this._width = opt.width || 0;
    this._height = opt.height || 21;
    this._timescale = opt.timescale || 0;
    this._currTime = opt.currTime || 0;
    this._length = opt.length || 60000;

    this._magnetPoints = [];

    this._onMDown = onMDown.bind(this);
    this._onMMove = onMMove.bind(this);
    this._onMUp = onMUp.bind(this);

    this._steps = getSteps();

    this._createBase();
    this._createPointer();
    this._createEndShadow();

    this._renderTape();
//TODO use amgui.makeDraggable()
    this._canvasTape.addEventListener('mousedown', this._onMDown);

    decorTimebarNavigator(this);
}

inherits(Timebar, EventEmitter);
var p = Timebar.prototype;
module.exports = Timebar;




Object.defineProperties(p, {

    /** px/ms */
    timescale: {
        set: function (v) {

            if (!Number.isFinite(v) || this._timescale === v) return;

            this._timescale = Math.min(1, Math.max(0.0001, v));
            this._renderTape();
            this.emit('changeTape');
        },
        get: function () {
            return this._timescale;
        }
    },

    start: {
        set: function (v) {

            v = parseInt(v);

            if (!Number.isFinite(v) || this._start === v) return;

            this._start = Math.min(0, v);
            this._renderTape();
            this.emit('changeTape');
        },
        get: function () {
            return this._start;
        }
    }, 

    width: {
        set: function (v) {

            v = parseInt(v);

            if (!Number.isFinite(v) || this._width === v) return;
            
            this._width = v;
            this._renderTape();
            this.emit('changeTape');
        },
        get: function () {
            return this._width;
        }
    }, 
    
    end: {
        get: function () {
            return this._start + (this._width / this._timescale);
        }
    },
    
    visibleTime: {
        set: function (v) {
            this.timescale = this._width / v;
        },

        get: function () {
            return this._width / this._timescale;
        }
    },
    
    currTime: {
        set: function (v) {

            v = parseInt(v);

            if (!Number.isFinite(v) || this._currTime === v) return;

            this._currTime = v;

            this._refreshPointer();

            this.emit('changeTime', this._currTime);
        },
        get: function () {
            return this._currTime;
        }
    }, 
    
    magnetPoints: {
        set: function (v) {
            this._magnetPoints = v;
        },
        get: function () {
            return this._magnetPoints;
        }
    },

    length: {
        set: function (v) {

            v = parseInt(v);

            if (!Number.isFinite(v) || this._length === v) return;
            this._length = v;

            this._renderTape();
            this.emit('changeTape');
        },
        get: function () {
            return this._length;
        }
    },
});
















p._renderTape = function () {

    var start = this._start,
        length = this._length,
        visibleTime = this.visibleTime,
        height = this._height,
        scale = this.timescale, 
        width = this._width,
        maxMarkers = width / 4,
        step, i, text, textW,
        ctx = this._ctxTape;

    this._canvasTape.width = width;
    this._canvasTape.height = height;

    this._steps.forEach(function (s) {

        if ((this.visibleTime / s.small) < maxMarkers && (!step || step.small > s.small)) {

            step = s;
        }
    }, this);

    if (step) {

        ctx.linweidth = 0.5;
        ctx.strokeStyle = amgui.color.bg3;
        ctx.fillStyle = amgui.color.bg3;
        ctx.font = ~~(this._height * 0.5) + 'px "Open Sans"';

        for (i = start % step.small; i < visibleTime; i += step.small) {

            ctx.moveTo(~~(i * scale) + 0.5, height);
            ctx.lineTo(~~(i * scale) + 0.5, height * 0.75);
        }
        ctx.stroke();

        for (i = start % step.big; i < visibleTime; i += step.big) {

            ctx.moveTo(~~(i * scale) + 0.5, height);
            ctx.lineTo(~~(i * scale) + 0.5, height * 0.62);
        }
        ctx.stroke();

        for (i = start % step.time; i < visibleTime; i += step.time) {

            text = step.format(i - start);
            textW = ctx.measureText(text).width / 2;
            ctx.fillText(text, i * scale - textW, 12);
        }
        ctx.stroke();
    }

    this._refreshPointer();

    var endWidth = ((visibleTime - (start + length)) * scale);
    this._deEndShadow.style.width = Math.max(0, Math.min(width, endWidth)) + 'px';
};












function onMDown(e) {

    e.stopPropagation();
    e.preventDefault();

    if (e.shiftKey) this._dragMode = 'translate';
    else if (e.ctrlKey) this._dragMode = 'scale';
    else this._dragMode = 'seek';

    this._mdX = e.pageX;
    this._mdStart = this._start;
    this._mdTimescale = this._timescale;

    this._onMMove(e);

    window.addEventListener('mousemove', this._onMMove);
    window.addEventListener('mouseup', this._onMUp);
    window.addEventListener('mouseleave', this._onMUp);
}

function onMMove(e) {

    var left = this._canvasTape.getBoundingClientRect().left,
        mouseX = Math.max(0, Math.min(this.width, e.pageX - left)),
        move = e.pageX - this._mdX,
        time, magnetPoint, magnetPointDiff;

    if (this._dragMode === 'seek') {

        time = (mouseX / this.width) * this.visibleTime;

        time -= this._start;

        this._magnetPoints.forEach(function (mp) {

            var diff = Math.abs(mp - time);

            if (diff < magnetPointDiff || magnetPointDiff === undefined) {
                magnetPoint = mp;
                magnetPointDiff = diff;
            }
        });
        
        if ((magnetPointDiff * this._timescale) < 2) {

            time = magnetPoint;
        }

        this.currTime = time;

        this.emit('seek');
    }
    else if (this._dragMode === 'translate') {

        this.start = this._mdStart + (move / this.timescale);
    }
    else if (this._dragMode === 'scale') {

        this.timescale = this._mdTimescale + (move/1000);

        var mdPos = (this._mdStart + this.currTime) * this._mdTimescale;
        this.start = -((this.currTime * this.timescale) - mdPos) / this.timescale;
    }
}

function onMUp() {

    window.removeEventListener('mousemove', this._onMMove);
    window.removeEventListener('mouseup', this._onMUp);
    window.removeEventListener('mouseleave', this._onMUp);
}










p._refreshPointer = function () {

    var pos = ((this.start + this.currTime) / this.visibleTime) * this.width;

    this._dePointer.style.left = pos + 'px';
};











p._createBase = function () {

    this.domElem = document.createElement('div');
    this.domElem.style.backgroundColor = amgui.color.bg0;
    this.domElem.style.position = 'relative';

    this._canvasTape = document.createElement('canvas');
    this._ctxTape = this._canvasTape.getContext('2d');
    this._canvasTape.style.display = 'block';
    this.domElem.appendChild(this._canvasTape); 
};

p._createPointer = function () {

    var radius = 5.5;
    this._dePointer = document.createElement('div');
    this._dePointer.style.position = 'absolute';
    this._dePointer.style.bottom = 2*radius + 'px';
    var pointer = document.createElement('div');
    pointer.style.position = 'absolute';
    pointer.style.boxSizing = 'border-box';
    pointer.style.pointerEvents = 'none';
    pointer.style.left = -radius + 'px';
    pointer.style.width = 2*radius + 'px';
    pointer.style.height = 2*radius + 'px';
    pointer.style.border = 'solid red 1px';
    pointer.style.borderRadius = radius + 'px';
    this._dePointer.appendChild(pointer); 
    this.domElem.appendChild(this._dePointer); 
};

p._createEndShadow = function () {

    this._deEndShadow = document.createElement('div');
    this._deEndShadow.style.position = 'absolute';
    this._deEndShadow.style.top = '0px';
    this._deEndShadow.style.right = '0px';
    this._deEndShadow.style.height = '100%';
    this._deEndShadow.style.width = '0px';
    this._deEndShadow.style.pointerEvents = 'none';
    this._deEndShadow.style.backgroundColor = 'rgba(83,83,83,0.73)';
    this.domElem.appendChild(this._deEndShadow); 

    var handler = document.createElement('div');
    handler.style.position = 'absolute';
    handler.style.top = '0px';
    handler.style.left = '0px';
    handler.style.height = '100%';
    handler.style.width = '3px';
    handler.style.cursor = 'ew-resize';
    handler.style.pointerEvents = 'auto';
    this._deEndShadow.appendChild(handler);

    amgui.makeDraggable({
        deTarget: handler,
        thisArg: this,
        onDown: function () {
            return {
                length: this.length,
            };
        },
        onMove: function (md, mx) {

            var dx = mx - md.mx;
            this.length = md.length + (dx / this.timescale);
        }
    });
};








//Steps
function getSteps() {

    return [
        {
            small: 5, 
            big: 50, 
            time: 50, 
            format: function (ms) {
                
                return ms + 'ms';
            } 
        },
        {
            small: 10, 
            big: 100, 
            time: 100, 
            format: function (ms) {
                
                return ms + 'ms';
            } 
        },
        {
            small: 100, 
            big: 1000, 
            time: 1000, 
            format: function (ms) {
                var min = parseInt(ms/60000);
                var sec = parseInt(ms/1000) % 60;

                return (min ? min+':'+two(sec) : sec) + 's';
            } 
        },
        {
            small: 500, 
            big: 5000, 
            time: 5000, 
            format: function (ms) {
                var min = parseInt(ms/60000);
                var sec = parseInt(ms/1000) % 60;

                return (min ? min+':'+two(sec) : sec) + 's';
            } 
        },
        {
            small: 10000, 
            big: 60000, 
            time: 60000, 
            format: function (ms) {
                var min = parseInt(ms/60000) % 60;
                var hour = parseInt(ms/3600000);

                return (hour ? hour+':'+two(min) : min) + 'm';
            } 
        },
        {
            small: 60000, 
            big: 5*60000, 
            time: 5*60000, 
            format: function (ms) {
                var min = parseInt(ms/60000) % 60;
                var hour = parseInt(ms/3600000);

                return (hour ? hour+':'+two(min) : min) + 'm';
            } 
        }
    ];

    function two(num) {

        return ('00' + num).substr(-2);
    }
}

},{"../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","./decorTimebarNavigator":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\timeline\\decorTimebarNavigator.js","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\timeline\\Timeline.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var Timebar = require('./Timebar');
var amgui = require('../amgui');
var mineSave = require('./mineSave');
var UglifyJS = require('uglify-js');
var mstSaveScript = require('./script.save.mst');

function Timeline(opt) {

    EventEmitter.call(this);
    this.setMaxListeners(1100);

    this._headerH = 23;

    this._onSelectSequence = this._onSelectSequence.bind(this);
    this._onChangeSequence = this._onChangeSequence.bind(this);
    this._onDeleteSequence = this._onDeleteSequence.bind(this);
    this._onMoveSequence = this._onMoveSequence.bind(this);
    this._onChangeTime = this._onChangeTime.bind(this);
    this._onChangeTape = this._onChangeTape.bind(this);
    this._onWindowResize = this._onWindowResize.bind(this);
    this._onSelectNewSequ = this._onSelectNewSequ.bind(this);
    this._onTogglePlayPause = this._onTogglePlayPause.bind(this);
    this._onTimebarSeek = this._onTimebarSeek.bind(this);
    this._onChangeSequenceHeight = this._onChangeSequenceHeight.bind(this);
    this._onStartEditCurrTime = this._onStartEditCurrTime.bind(this);
    this._onFinishEditCurrTime = this._onFinishEditCurrTime.bind(this);
    this._onChangeInpCurrTime = this._onChangeInpCurrTime.bind(this);
    this._animPlay = this._animPlay.bind(this);
    
    this._timebar = new Timebar({
        height: this._headerH,
        timescale: 0.12,
        length: 6000
    });
    
    this._createBase();
    this._createPointerLine();


    this._refreshTimebarWidth();
    this._refreshDeCurrTime();

    this._sequences = [];
    this._mapSequenceDatas = new WeakMap();

    this._timebar.on('changeTime', this.emit.bind(this, 'changeTime'));
    this._timebar.on('changeTape', this.emit.bind(this, 'changeTape'));
    this._timebar.on('changeTime', this._onChangeTime);
    this._timebar.on('changeTape', this._onChangeTape);
    this._timebar.on('seek', this._onTimebarSeek);

    amgui.callOnAdded(this.domElem, this._refreshTimebarWidth, this);
    
    window.addEventListener('resize', this._onWindowResize);

    if (opt) {
        this.useSave(opt);
    }
}

inherits(Timeline, EventEmitter);
var p = Timeline.prototype;
module.exports = Timeline;






Object.defineProperties(p, {

    'currTime': {
        get: function () {
            return this._timebar._currTime;
        }
    },
    'timescale': {
        get: function () {
            return this._timebar.timescale;
        }
    },
    'sequences': {
        get: function () {
            return this._sequences;
        }
    },
    'length': {
        get: function () {
            return this._timebar.length;
        }
    }
});

p.getSave = function () {

    var save = {
        timebar: {
            currTime: this._timebar.currTime,
            timescale: this._timebar.timescale,
            length: this._timebar.length,
        },
        sequences: []
    };

    this._sequences.forEach(function (sequ) {

        save.sequences.push({
            type: sequ.type,
            data: sequ.getSave()
        });
    });

    console.log(JSON.stringify(save));

    return JSON.stringify(save);
};

p.useSave = function (save) {

    save = mineSave(save);

    if (!save) {
        alert('Can\'t use this save');
    }

    this.clear();

    save = _.extend({
        timebar: {},
        sequences: []
    }, save);

    this._timebar.currTime = save.timebar.currTime;
    this._timebar.timescale = save.timebar.timescale;
    this._timebar.length = save.timebar.length;

    save.sequences.forEach(function (sequData) {

        var SequClass = am.sequenceTypes[sequData.type],
            sequ = new SequClass(sequData.data);

        this.addSequence(sequ);
    }, this);

    _.invoke(this._sequences, 'renderTime', this.currTime);

    am.history.clear();
};

p.getScript = function (opt) {

    opt = opt || {};

    var script, playerScripts = [];

    this._sequences.forEach(function (sequ) {

        playerScripts.push(sequ.getScript());
    });

    script = Mustache.render(mstSaveScript, {
        name: 'amsave',
        saveJson: opt.includeSave && this.getSave(),
        sequPlayerGens: playerScripts.join(',\n'),
        autoPlay: opt.autoPlay
    });

    if (opt.minify) {

    console.log(script);
        script = minify(script);
    }

    console.log(script);

    return script;

    function minify(code) {

        return code;//TODO

        var result = UglifyJS.minify(code, {
            fromString: true,
            mangle: false,
            output: {
                comments: /@amsave/,
            },
            compress: {
                // reserved: 'JSON_SAVE',
            }
        });

        return result.code;

        var toplevel = null;
        toplevel = UglifyJS.parse(code, {
            filename: 'save',
            toplevel: toplevel
        });

        toplevel.figure_out_scope();

        var compressor = UglifyJS.Compressor({mangle: false});
        var compressed_ast = toplevel.transform(compressor);

        compressed_ast.figure_out_scope();
        compressed_ast.compute_char_frequency();
        compressed_ast.mangle_names();

        return compressed_ast.print_to_string({comments: 'all'});
    } 
};

p.clear = function () {
    
    while(this._sequences.length) {

        this.removeSequence(this._sequences[0]);
    }
};

p.addSequence = function (sequ, skipHistory) {

    if (!skipHistory) {
        am.history.save([this.removeSequence, this, sequ, true],
            [this.addSequence, this, sequ, true]);
    }
    
    this._sequences.push(sequ);

    this._mapSequenceDatas.set(sequ, {
        deContOpt: createCont(sequ.deOptions, this._deOptionsCont),
        deContKf: createCont(sequ.deKeys, this._deKeylineCont),
    });

    this._onChangeSequenceHeight(sequ);

    sequ.on('select', this._onSelectSequence);
    sequ.on('change', this._onChangeSequence);
    sequ.on('delete', this._onDeleteSequence);
    sequ.on('move', this._onMoveSequence);
    sequ.on('changeHeight', this._onChangeSequenceHeight);

    function createCont(content, parent) {

        var de = document.createElement('div');
        de.style.width = '100%';
        de.style.height = sequ.height + 'px';
        de.style.overflow = 'hidden';
        de.style.transform = 'height 0.12 easeOut';
        de.appendChild(content);
        parent.appendChild(de);

        return de;
    }
};

p.removeSequence = function (sequ, skipHistory) {

    if (!skipHistory) {
        am.history.save([this.addSequence, this, sequ, true],
            [this.removeSequence, this, sequ, true]);
    }

    var idx = this._sequences.indexOf(sequ);

    if (idx === -1) {
        return;
    }

    this._sequences.splice(idx, 1);

    var sequData = this._mapSequenceDatas.get(sequ);
    $(sequData.deContOpt).remove();
    $(sequData.deContKf).remove();
    this._mapSequenceDatas.delete(sequ);

    sequ.removeListener('select', this._onSelectSequence);
    sequ.removeListener('change', this._onChangeSequence);
    sequ.removeListener('delete', this._onDeleteSequence);
    sequ.removeListener('move', this._onMoveSequence);
    sequ.removeListener('changeHeight', this._onChangeSequenceHeight);

    sequ.dispose();
};

p.moveSequence = function (sequ, way) {

    var idx = this._sequences.indexOf(sequ);

    this._sequences.splice(idx, 1);
    idx = Math.min(this._sequences.length, Math.max(0, idx + way));
    this._sequences.splice(idx, 0, sequ);

    this._refreshSequenceOrdering();
};

p.play = function () {

    if (this._isPlaying) return;
    this._isPlaying = true;

    this._btnTogglePlay.setToggle(true);

    _.invoke(this._sequences, 'play', this.currTime);

    this._playStartTimeStamp = performance.now();
    this._playStartCurrTime = this.currTime;
    this._animPlay();
};

p.pause = function () {

    if (!this._isPlaying) return;
    this._isPlaying = false;

    this._btnTogglePlay.setToggle(false);

    _.invoke(this._sequences, 'pause');

    window.cancelAnimationFrame(this._animPlayRafid);
};








p._animPlay = function () {

    this._animPlayRafid = window.requestAnimationFrame(this._animPlay);

    var t = Math.round(performance.now() - this._playStartTimeStamp);
    this._timebar.currTime = (this._playStartCurrTime + t) % this._timebar.length;
};

p._onTimebarSeek = function () {

    this.pause();
};

p._onSelectSequence = function(sequ) {

    if (this._currSequence === sequ) 
        return;

    if (this._currSequence) {
        
        this._currSequence.deselect(); 
    }

    this._currSequence = sequ;
};

p._onChangeSequence = function() {

    this._refreshMagnetPoints();
};

p._onDeleteSequence = function (sequ) {

    this.removeSequence(sequ);
};

p._onMoveSequence = function (sequ, way) {

    this.moveSequence(sequ, way);
};

p._onChangeTime = function () {

    this._refreshDePointer();

    this._refreshDeCurrTime();
};

p._onChangeTape = function () {

    var left = (this._timebar.start * this.timescale);

    this._deKeylineCont.style.left = left + 'px';
    this._deKeylineCont.style.width = 'calc(100% + ' + (-left) + 'px)';

    this._refreshDePointer();
};

p._onChangeSequenceHeight = function (sequ) {

    var h = sequ.height,
        sequData = this._mapSequenceDatas.get(sequ);

    sequData.deContOpt.style.height = h + 'px';
    sequData.deContKf.style.height = h + 'px';
};

p._onWindowResize = function () {

    this._refreshTimebarWidth();
};

p._onTogglePlayPause = function () {

    if (this._isPlaying) {

        this.pause();
    }
    else {
        this.play();
    }
};

p._onSelectNewSequ = function (e) {

    var addSequ = function (type) {

        var SequClass = am.sequenceTypes[type];

        this.addSequence(new SequClass());
    }.bind(this);

    switch (e.detail.selection) {

        case 'css':
            addSequ('css_sequ_type');
            break;

        case 'js':
            addSequ('js_sequ_type');
            break;

        default:
            am.dialogs.featureDoesntExist.show();
            
    }
};

p._onStartEditCurrTime = function () {

    this._inpCurrTime.value = this.currTime;

    this._deCurrTime.style.display = 'none';
    this._inpCurrTime.style.display = 'block';

    this._inpCurrTime.focus();
};

p._onFinishEditCurrTime = function () {

    this._inpCurrTime.style.display = 'none';
    this._deCurrTime.style.display = 'block';
};

p._onChangeInpCurrTime = function () {

    this._timebar.currTime = this._inpCurrTime.value;
};








p._refreshSequenceOrdering = function () {

    this._sequences.forEach(function (sequ) {

        var sequData = this._mapSequenceDatas.get(sequ);

        this._deOptionsCont.appendChild(sequData.deContOpt);
        this._deKeylineCont.appendChild(sequData.deContKf);
    }, this);
};

p._refreshMagnetPoints = function () {

    var magnetPoints = [];

    this._sequences.forEach(function (sequ) {

        if (typeof sequ.getMagnetPoints === 'function') {

            magnetPoints = magnetPoints.concat(sequ.getMagnetPoints());
        }
    });

    magnetPoints = _.uniq(magnetPoints);

    this._timebar.magnetPoints = magnetPoints;
};

p._refreshTimebarWidth = function () {

    this._timebar.width = this._deRight.offsetWidth;
};

p._refreshDePointer = function () {

    var left = (this._timebar.start + this.currTime) * this.timescale;
    this._dePointerLine.style.left = left + 'px';
};

p._refreshDeCurrTime = function () {

    var time = this.currTime, 
        min, sec, ms, str  = '';

    min = ~~(time / 60000);
    time %= 60000;
    sec = ~~(time / 1000);
    time %= 1000;
    ms = ~~time;

    if (min) {
        str += min + ':';
        sec = ('00' + sec).substr(-2);
    }
    if (sec) {
        str += sec + ':';
        ms = ('000' + ms).substr(-3);
    }
    str += ms;
    this._deCurrTime.textContent = str;
};







p._createBase = function () {

    this.domElem = document.createElement('div');
    this.domElem.style.backgroundColor = amgui.color.bg0; 
    this.domElem.style.display = 'flex'; 
    this.domElem.style.pointerEvents = 'auto'; 

    this._deLeft = document.createElement('div');
    this._deLeft.style.backgroundColor = amgui.color.bg0;
    this._deLeft.style.display = 'flex';
    this._deLeft.style.flexDirection = 'column';
    this._deLeft.style.width = '300px';
    this._deLeft.style.height = '100%';
    this.domElem.appendChild(this._deLeft);

    this._createSettingsHead();

    this._deDivider = document.createElement('div');
    this._deDivider.style.backgroundColor = amgui.color.bg3;
    this._deDivider.style.width = '1px';
    this._deDivider.style.height = '100%';
    this.domElem.appendChild(this._deDivider);

    this._deRight = document.createElement('div');
    this._deRight.style.display = 'flex';
    this._deRight.style.flexDirection = 'column';
    this._deRight.style.position = 'relative';
    this._deRight.style.backgroundColor = amgui.color.bg0;
    this._deRight.style.flex = '1';
    this._deRight.style.height = '100%';
    this.domElem.appendChild(this._deRight);

    this._timebar.domElem.style.height = '23px';
    this._deRight.appendChild(this._timebar.domElem);

    this._deKeylineCont3 = document.createElement('div');
    this._deKeylineCont3.style.position = 'relative';
    this._deKeylineCont3.style.display = 'flex';
    this._deKeylineCont3.style.flex = '1';
    this._deKeylineCont3.style.height = '100%';
    this._deKeylineCont3.style.width = '100%';
    this._deKeylineCont3.style.overflow = 'hidden';
    this._deRight.appendChild(this._deKeylineCont3);

    this._deOptionsCont2 = document.createElement('div');
    this._deOptionsCont2.style.position = 'relative';
    this._deOptionsCont2.style.flex = '1';
    this._deOptionsCont2.style.width = '100%';
    this._deOptionsCont2.style.height = '100%';
    this._deOptionsCont2.style.overflow = 'hidden';
    this._deLeft.appendChild(this._deOptionsCont2);

    this._deKeylineCont2 = document.createElement('div');
    this._deKeylineCont2.style.position = 'relative';
    this._deKeylineCont2.style.flex = '1';
    this._deKeylineCont3.appendChild(this._deKeylineCont2);

    this._deKeylineCont = document.createElement('div');
    this._deKeylineCont.style.position = 'relative';
    this._deKeylineCont.style.width = '100%';
    this._deKeylineCont2.appendChild(this._deKeylineCont);

    this._deOptionsCont = document.createElement('div');
    this._deOptionsCont.style.position = 'relative';
    this._deOptionsCont2.appendChild(this._deOptionsCont);

    this._deRange = amgui.createRange({
        width: '6px',
        height: 'auto',
        parent: this._deKeylineCont3,
        vertical: true
    });

    amgui.makeScrollable({
        deCont: [this._deOptionsCont2, this._deKeylineCont3],
        deTarget: [this._deOptionsCont, this._deKeylineCont],
        deRange: this._deRange
    });

    this._createDividerHandler();
};


p._createSettingsHead = function () {

    this._deSettingsHead = document.createElement('div');
    this._deSettingsHead.style.backgroundColor = 'darkgreey';
    this._deSettingsHead.style.display = 'flex';
    this._deSettingsHead.style.width = '100%';
    this._deSettingsHead.style.height = this._headerH + 'px';
    this._deLeft.appendChild(this._deSettingsHead);

    this._btnNewSequ = amgui.createIconBtn({
        icon: 'plus-squared',
        parent: this._deSettingsHead,
        display: 'inline-block'
    });

    amgui.bindDropdown({
        deTarget: this._btnNewSequ,
        deMenu: amgui.createDropdown({
            options: ['css', 'js', 'attribute', 'media', 'timeline', 'three.js', 'pixi.js'],
            onSelect: this._onSelectNewSequ
        })
    });

    
    this._btnTogglePlay = amgui.createToggleIconBtn({
        iconOn: 'pause', 
        iconOff: 'play',
        parent: this._deSettingsHead,
        display: 'inline-block',
        onClick: this._onTogglePlayPause
    });

    this._deCurrTime = amgui.createLabel({
        caption: '',
        parent: this._deSettingsHead
    });
    this._deCurrTime.style.flex = '1';
    this._deCurrTime.style.textAlign = 'right';
    this._deCurrTime.style.fontSize = '12px';
    this._deCurrTime.style.marginRight = '2px';
    this._deCurrTime.style.color = amgui.color.bg3;
    this._deCurrTime.addEventListener('click', this._onStartEditCurrTime);

    this._inpCurrTime = amgui.createInput({
        type: 'number',
        parent: this._deSettingsHead
    });
    this._inpCurrTime.style.display = 'none';
    this._inpCurrTime.style.flex = '1';
    this._inpCurrTime.style.textAlign = 'right';
    this._inpCurrTime.style.fontSize = '12px';
    this._inpCurrTime.style.marginRight = '2px';
    this._inpCurrTime.style.color = amgui.color.bg3;
    this._inpCurrTime.addEventListener('blur', this._onFinishEditCurrTime);
    this._inpCurrTime.addEventListener('change', this._onChangeInpCurrTime);
};

p._createDividerHandler = function () {

    this._deDividerHandler = document.createElement('div');
    this._deDividerHandler.style.top = this._headerH + 'px';
    this._deDividerHandler.style.left = this._deLeft.style.width;
    this._deDividerHandler.style.width = '1px';
    this._deDividerHandler.style.position = 'absolute';
    this._deDividerHandler.style.height = 'calc(100% - ' + this._headerH + 'px)';
    this._deDividerHandler.style.transform = 'scaleX(3)';
    this._deDividerHandler.style.cursor = 'ew-resize';
    this.domElem.appendChild(this._deDividerHandler);

    amgui.makeDraggable({

        deTarget: this._deDividerHandler,
        thisArg: this,
        
        onMove: function (md, mx) {

            var left = mx - this.domElem.getBoundingClientRect().left + 'px';

            this._deLeft.style.width = left;
            this._deDividerHandler.style.left = left;

            this._refreshTimebarWidth();
        }
    });
};

p._createPointerLine = function () {

    this._dePointerLine = document.createElement('div');
    this._dePointerLine.style.top = this._headerH + 'px';
    this._dePointerLine.style.width = '0px';
    this._dePointerLine.style.position = 'absolute';
    this._dePointerLine.style.userSelect = 'none';
    this._dePointerLine.style.height = '100%';
    this._dePointerLine.style.borderLeft = '1px solid red';
    this._deRight.appendChild(this._dePointerLine);
};
},{"../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","./Timebar":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\timeline\\Timebar.js","./mineSave":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\timeline\\mineSave.js","./script.save.mst":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\timeline\\script.save.mst","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js","uglify-js":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\uglify-js\\tools\\node.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\timeline\\decorTimebarNavigator.js":[function(require,module,exports){
'use strict';

var amgui = require('../amgui');


function decorTimebarNavigator (timebar) {

    var deNav, deLeftHand, deRightHand, dragMode;
    
    createBase();
    timebar.domElem.appendChild(deNav);

    amgui.makeDraggable({
        deTarget: deNav,
        onDown: function (e) {

            if (e.target === deLeftHand) dragMode = 'start';
            else if (e.target === deRightHand) dragMode = 'end';
            else dragMode = 'move';

            return {
                start: timebar.start,
                visibleTime: timebar.visibleTime,
                timescale: timebar.timescale,
            };
        },
        onMove: function (md, mx) {

            var scale = timebar.width / timebar.length,
                move = (mx - md.mx) / scale,
                start = md.start - move;

            if (dragMode === 'move') {

                timebar.start = start;
            }
            else if (dragMode === 'start') {

                timebar.start = start;
                timebar.visibleTime = md.visibleTime - move;
            }
            else if (dragMode === 'end') {

                timebar.visibleTime = md.visibleTime + move;

                var mdPos = (md.start + timebar.currTime) * md.timescale;
                timebar.start = -((timebar.currTime * timebar.timescale) - mdPos) / timebar.timescale;
            }   
        },
        onUp: function () {

            dragMode = undefined;
            onMLeave();
        },
        onEnter: function () {

            deNav.style.transform = 'scaleY(1)';
        },
        onLeave: onMLeave
    });

    timebar.on('changeTape', onChangeTape);


    function onChangeTape() {

        var scale = timebar.width / timebar.length;

        deNav.style.left = (-timebar.start * scale) + 'px';
        deNav.style.width = (timebar.visibleTime * scale) + 'px';
    }

    function onMLeave() {

        if (!dragMode) {
            deNav.style.transform = 'scaleY(0.4)';
        }
    }

    function createBase () {

        deNav = document.createElement('div');
        deNav.style.position = 'absolute';
        deNav.style.top = '0px';
        deNav.style.height = '7px';
        deNav.style.cursor = 'move';
        deNav.style.transformOrigin = 'center top';
        deNav.style.background = amgui.color.bg2;

        deRightHand = createHandler('right');
        deLeftHand = createHandler('left');
        onMLeave();
    }

    function createHandler(side) {

        var de = document.createElement('div');
        de.style.position = 'absolute';
        de.style[side] = '0px';
        de.style.top = '0px';
        de.style.height = '100%';
        de.style.width = '8%';
        de.style.minWidth = '1px';
        de.style.maxWidth = '7px';
        de.style.cursor = 'ew-resize';
        deNav.appendChild(de);

        return de;
    }
}

module.exports = decorTimebarNavigator;
},{"../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\timeline\\mineSave.js":[function(require,module,exports){
"use strict";

module.exports = mine;

function mine(str) {

    if (typeof(str) === 'object') {

        return str;
    }

    var rx = /\/\*\*[\s\S].*@amsave[\s\S].*\*\/[\s\S].*var\s.*SAVEJSON\s.*=([\s\S].*)/,
        m = rx.exec(str),
        json;

    if (m && m[1]) {

        json = extractJSON(m[1])[0];

        if (json) {
            return json;
        }
    }
}

//http://stackoverflow.com/a/10574546/3615288
function extractJSON(str) {
    var firstOpen, firstClose, candidate;
    firstOpen = str.indexOf('{', firstOpen + 1);
    do {
        firstClose = str.lastIndexOf('}');
        console.log('firstOpen: ' + firstOpen, 'firstClose: ' + firstClose);
        if(firstClose <= firstOpen) {
            return null;
        }
        do {
            candidate = str.substring(firstOpen, firstClose + 1);
            console.log('candidate: ' + candidate);
            try {
                var res = JSON.parse(candidate);
                console.log('...found');
                return [res, firstOpen, firstClose + 1];
            }
            catch(e) {
                console.log('...failed');
            }
            firstClose = str.substr(0, firstClose).lastIndexOf('}');
        } while(firstClose > firstOpen);
        firstOpen = str.indexOf('{', firstOpen + 1);
    } while(firstOpen !== -1);
}
},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\timeline\\script.save.mst":[function(require,module,exports){
module.exports = ";(function (root) {\n    'use strict';\n\n    {{#saveJson}}\n    /**@amsave*/\n    var SAVEJSON = '{{{saveJson}}}';\n    {{/saveJson}}\n\n    var sequPlayerGens = [{{{sequPlayerGens}}}];\n\n    root.am = root.am || {};\n    root.am.pageScripts = root.am.pageScripts || {};\n\n    var reg = root.am.pageScripts.{{name}} = {\n        \n        createPlayer: function (opt) {\n\n            var sequencePlayers = [];\n\n            sequPlayerGens.forEach(function (create) {\n\n                sequencePlayers.push(create(opt))   ;\n            });\n\n            return {\n                play: callPlayers.bind(null, 'play'),\n                pause: callPlayers.bind(null, 'pause'),\n                seek: callPlayers.bind(null, 'seek'),\n            };\n\n            function callPlayers(fnName, arg1) {\n\n                sequencePlayers.forEach(function (sequencePlayer) {\n\n                    sequencePlayer[fnName].call(null, arg1);\n                });\n            }\n        },\n        \n        {{#saveJson}}\n        saveJson: SAVEJSON,\n        {{/saveJson}}\n    };\n\n\n    if (typeof define === 'function' && define.amd) {\n        \n        define(function () {\n            return reg;\n        });\n    }\n\n    if (typeof exports === 'object') {\n        \n        module.exports = reg;\n    }\n\n\n    {{#autoPlay}}\n    if (document.readyState == 'interactive' || document.readyState == 'complete') {\n\n        reg.createPlayer().play();\n    }\n    else {\n        document.addEventListener('DOMContentLoaded', function () {\n\n            reg.createPlayer().play();\n        });\n    }\n    {{/autoPlay}}\n}(this));";

},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\toolbar\\Toolbar.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var amgui = require('../amgui');

function Toolbar() {

    EventEmitter.call(this);

    this._height = 32;
    this._icons = [];
    this._separators = {};

    this.domElem = document.createElement('div');
    this.domElem.style.position = 'fixed';
    this.domElem.style.backgroundColor = 'darkslategrey';
    this.domElem.style.pointerEvents = 'auto';
    this.domElem.style.height = this._height + 'px';

    this.addSeparator('first');
    this.addSeparator('tools');
    this.addSeparator('handler');
    this.addSeparator('global');
    this.addSeparator('rest');
}

inherits(Toolbar, EventEmitter);
var p = Toolbar.prototype;
module.exports = Toolbar;


p.addIcon = function (opt) {

    var deIcon = opt.deIcon || amgui.createIconBtn({
        width: 32,
        height: 32,
        fontSize: '32px',
        icon: opt.icon,
        onClick: opt.onClick
    });

    amgui.addTooltip({
        deTarget: deIcon,
        text: 'tooltip',
        side: 'bottom'
    });

    deIcon.style.display = 'inline-block';

    this.domElem.insertBefore(deIcon, this._separators[opt.separator || 'rest']);

    return deIcon;
};

p.removeIcon = function (deIcon) {

    deIcon.parentNode.removeChild(deIcon);
};

p.addSeparator = function (name) {

    var de = document.createElement('span');
    this.domElem.appendChild(de);
    this._separators[name] = de;
};
},{"../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\transhand\\Transhand.js":[function(require,module,exports){
'use strict';

var Transformer = require('./hands/Transformer');
var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');

function Transhand() {

    EventEmitter.call(this);

    this.hands = {};

    [Transformer].forEach(function (Hand) {

        var hand = new Hand();

        hand.on('change', this.emit.bind(this, 'change'));

        this.hands[Hand.id] = hand;
    }, this);
}

inherits(Transhand, EventEmitter);

var p = Transhand.prototype;

p.setup = function (opt) {

    var hand = this.hands[opt.hand.type];

    if (hand) {

        hand.setup(opt.hand);
        this.domElem = hand.domElem;
        this._currHand = hand;
    }
    else {
        throw 'Unknown hand type: ' + opt.hand.type;
    }

    if (typeof(opt.on) === 'object') {

        Object.keys(opt.on).forEach(function (eventType) {

            this.on(eventType, opt.on[eventType]);
        }, this);
    }
};

p.activate = function () {

    if (this._currHand) {

        this._currHand.activate();
    }
};

p.deactivate = function () {

    if (this._currHand) {

        this._currHand.deactivate();
    }
};

module.exports = Transhand;
},{"./hands/Transformer":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\transhand\\hands\\Transformer.js","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\transhand\\hands\\Transformer.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var _ = require('lodash');

var MOUSESTATES = {
    'move': 'move',
    'rotate': '-webkit-grab',
    'origin': 'crosshair',
    '1000': 'ns-resize',
    '1100': 'nesw-resize',
    '0100': 'ew-resize',
    '0110': 'nwse-resize',
    '0010': 'ns-resize',
    '0011': 'nesw-resize',
    '0001': 'ew-resize',
    '1001': 'nwse-resize',
};


function Transformer() {

    EventEmitter.call(this);

    this._params = {
        tx: 0, ty: 0,
        sx: 1, sy: 1,
        rz: 0,
        ox: 0.5, oy: 0.5
    };
    this._base = {x: 0, y: 0, w: 0, h: 0};
    this._points = [{}, {}, {}, {}];
    this._pOrigin = {};
    this._originRadius = 6;

    this._onDrag = this._onDrag.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
}

Transformer.id = 'transformer';

inherits(Transformer, EventEmitter);

var p = Transformer.prototype;

p.setup = function (opt) {

    if (!this.domElem) {
        this.createGraphics();
    }

    _.extend(this._params, opt.params);
    _.extend(this._base, opt.base);
    this._refreshPoints();
    this._renderHandler();
};

p.activate = function () {

    if (this._isActivated) return;
    this._isActivated = true;

    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
};

p.deactivate = function () {

    if (!this._isActivated) return;
    this._isActivated = false;
    
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
};

p.createGraphics = function () {

    this.domElem = document.createElement('canvas');
    this.domElem.style.position = 'fixed';
    this.domElem.style.pointerEvents = 'none';
    // this.domElem.style.border = '1px solid red';
};

p._refreshPoints = function () {

    var base = _.clone(this._base), 
        params = this._params,
        p = this._points,
        po = this._pOrigin;

    base.x += params.tx;
    base.y += params.ty;
    
    po.x = base.x + (base.w * params.ox);
    po.y = base.y + (base.h * params.oy);

    var tox = base.x + params.ox * base.w,
        toy = base.y + params.oy * base.h;

    t(p[0], base.x, base.y);
    t(p[1], base.x + base.w, base.y);
    t(p[2], base.x + base.w, base.y + base.h);
    t(p[3], base.x, base.y + base.h);

    function t(p, x, y) {

        var dx = (x - tox) * params.sx,
            dy = (y - toy) * params.sy,
            d = Math.sqrt(dx*dx + dy*dy),
            rad = Math.atan2(dy, dx) + params.rz;

        p.x = tox + (d * Math.cos(rad));
        p.y = toy + (d * Math.sin(rad));
    }
};

p._renderHandler = function () {

    var p = this._points,
        po = this._pOrigin,
        c = this.domElem,
        or = this._originRadius,
        ctx = c.getContext('2d'),
        margin = 7,
        minX = Math.min(p[0].x, p[1].x, p[2].x, p[3].x, po.x),
        maxX = Math.max(p[0].x, p[1].x, p[2].x, p[3].x, po.x),
        minY = Math.min(p[0].y, p[1].y, p[2].y, p[3].y, po.y),
        maxY = Math.max(p[0].y, p[1].y, p[2].y, p[3].y, po.y);

    c.style.left = (minX - margin) + 'px';
    c.style.top = (minY - margin) + 'px';
    c.width = (maxX - minX) + (margin * 2);
    c.height = (maxY - minY) + (margin * 2);

    ctx.save();
    ctx.translate(margin - minX, margin - minY);
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    ctx.lineTo(p[1].x, p[1].y);
    ctx.lineTo(p[2].x, p[2].y);
    ctx.lineTo(p[3].x, p[3].y);
    ctx.closePath();

    ctx.moveTo(po.x - or, po.y);
    ctx.lineTo(po.x + or, po.y);
    ctx.moveTo(po.x, po.y - or);
    ctx.lineTo(po.x, po.y + or);
    

    // ctx.shadowColor = '#f00';
    // ctx.shadowBlur = 3;
    // ctx.shadowOffsetX = 0;
    // ctx.shadowOffsetY = 0;

    ctx.strokeStyle = '#4f2';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
};

p._onDrag = function (e) {

    var params = this._params,
        base = this._base,
        pOrigin = this._pOrigin,
        md = this._mdPos,
        finger = this._finger,
        pMouse = {x: e.clientX, y: e.clientY},
        dx = pMouse.x - md.pMouse.x,
        dy = pMouse.y - md.pMouse.y,
        alt = e.altKey,
        shift = e.shiftKey,
        change = {};

    if (finger === 'origin') {
        
        setOrigin();
    }
        
    if (finger === 'move') {

        setTransform();
    }
    
    if (finger.charAt(0) === '1') {

        setScale(-Math.PI/2, 'sy', -1);
    }

    if (finger.charAt(1) === '1') {

        setScale(0, 'sx', 1);
    }

    if (finger.charAt(2) === '1') {

        setScale(Math.PI/2, 'sy', 1);
    }

    if (finger.charAt(3) === '1') {

        setScale(Math.PI, 'sx', -1);
    }

    if (finger === 'rotate') {

        setRotation();
    }

    if (shift && 'sx' in change && 'sy' in change) {

        fixProportion();
    }


    this.emit('change', change, 'transform');





    function setScale(r, sN, way) {

        var rad = r + md.params.rz,
            mdDist = distToPointInAngle(md.pOrigin, md.pMouse, rad),
            dragDist = distToPointInAngle(md.pOrigin, pMouse, rad),
            scale = (dragDist / mdDist) * md.params[sN];

        if (alt) {
            var es = (scale - md.params[sN]) / 2,
                tN = 't' + sN.charAt(1),
                dN = sN.charAt(1) === 'x' ? 'w' : 'h';

            scale -= es;
            change[tN] = params[tN] = md.params[tN] + base[dN] * es/2 * way;            
        }

        change[sN] = params[sN] = scale;
    }

    function fixProportion() {

        var mx = pMouse.x - pOrigin.x,
            my = pMouse.y - pOrigin.y,
            mr = Math.abs(radDiff(params.rz, Math.atan2(my, mx))),
            isVertical = mr > Math.PI/4 && mr < Math.PI/4 * 3,
            spx = params.sx / md.params.sx,
            spy = params.sy / md.params.sy;

        spx *= spx < 0 ? -1 : 1;
        spy *= spy < 0 ? -1 : 1;
        
        var sp = isVertical ? spy : spx;

        change.sx = params.sx = md.params.sx * sp;
        change.sy = params.sy = md.params.sy * sp;
    }

    function setRotation() {

        var mdx = md.pMouse.x - pOrigin.x,
            mdy = md.pMouse.y - pOrigin.y,
            mdr = Math.atan2(mdy, mdx),
            mx = pMouse.x - pOrigin.x,
            my = pMouse.y - pOrigin.y,
            mr = Math.atan2(my, mx),
            r = mr - mdr;

        if (shift) {

            r = Math.floor(r / (Math.PI / 12)) * (Math.PI / 12);
        }

        change.rz = params.rz = md.params.rz + r;
    }

    function setTransform() {

        if (shift) {
            
            if (Math.abs(dx) > Math.abs(dy)) {

                change.tx = params.tx = md.params.tx + dx;
                change.ty = params.ty = md.params.ty;
            }
            else {
                change.tx = params.tx = md.params.tx;
                change.ty = params.ty = md.params.ty + dy;
            }
        }
        else {
            change.tx = params.tx = md.params.tx + dx;
            change.ty = params.ty = md.params.ty + dy;
        }
    }

    function setOrigin() {

        var mx = pMouse.x - md.pOrigin.x,
            my = pMouse.y - md.pOrigin.y,
            dist = Math.sqrt(mx*mx + my*my),
            r = Math.atan2(my, mx) - params.rz,
            x = (Math.cos(r) * dist) / params.sx,
            y = (Math.sin(r) * dist) / params.sy;

        change.ox = params.ox = md.params.ox + (x / base.w);
        change.oy = params.oy = md.params.oy + (y / base.h);
        change.tx = params.tx = md.params.tx + (mx - x);
        change.ty = params.ty = md.params.ty + (my - y);
    }
};

p._setFinger = function (e) {

    var base = this._base,
        params = this._params,
        p = this._points,
        po = this._pOrigin,
        diff = 3,
        rDiff = 16,
        mx = e.clientX,
        my = e.clientY,
        mp = {x: mx, y: my},
        dox = po.x - mx,
        doy = po.y - my,
        dOrigin = Math.sqrt(dox*dox + doy*doy),
        dTop = distToSegment(mp, p[0], p[1]),
        dLeft = distToSegment(mp, p[1], p[2]),
        dBottom = distToSegment(mp, p[2], p[3]),
        dRight = distToSegment(mp, p[3], p[0]),
        top = dTop < diff,
        left = dLeft < diff,
        bottom = dBottom < diff,
        right = dRight < diff,
        inside = isInside(mp, p),
        cursorScale;

    if (base.w * params.sx < diff * 2 && inside) {
        
        left = false;
        right = false;
    }

    if (base.h * params.sy < diff * 2 && inside) {
    
        top = false;
        bottom = false;
    }
    
    if (dOrigin < this._originRadius) {

        this._finger = 'origin';
    }
    else if (top || right || bottom || left) {

        this._finger = ('000' + (top * 1000 + left * 100 + bottom * 10 + right * 1)).substr(-4);
        cursorScale = true;
    }
    else if (inside) {

        this._finger = 'move';
    }
    else if (dTop < rDiff || dRight < rDiff || dBottom < rDiff || dLeft < rDiff) {

        this._finger = 'rotate';
    }
    else {
        this._finger = false;
    }


    if (this._finger === 'rotate') {

        this._cursorFunc = this._getRotateCursor;
    }
    else if (cursorScale) {

        this._cursorFunc = this._getScaleCursor;
    }
    else {
        this._cursorFunc = undefined;
        
        if (this._finger) {

            this.domElem.style.pointerEvents = 'auto';
            this._setCursor(MOUSESTATES[this._finger]);
        }
        else {
            this.domElem.style.pointerEvents = 'none';
            this._setCursor('auto');
        }
    }
};

p._setCursor = function (cursor) {

    this.domElem.style.cursor = cursor;
    document.querySelector("html").style.cursor = cursor;//hack! TODO
};

p._onMouseMove = function (e) {

    if (!this._isHandle) {

        if (am.isPickableDomElem(e.target)) {            

            this._setFinger(e);
        }
    }

    if (this._cursorFunc) {
        this._setCursor(this._cursorFunc(e.clientX, e.clientY));
    }
};

p._onMouseDown = function (e) {

    if (!this._finger || !am.isPickableDomElem(e.target)) {
        return;
    }

    e.stopPropagation();
    e.preventDefault();

    this._isHandle = true;

    this._mdPos = {
        pMouse: {x: e.clientX, y: e.clientY},
        params: _.cloneDeep(this._params),
        points: _.cloneDeep(this._points),
        pOrigin: _.cloneDeep(this._pOrigin)
    };

    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onDrag);
};

p._onMouseUp = function () {

    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mouseleave', this._onMouseUp);
    window.removeEventListener('mousemove', this._onDrag);
    
    this._isHandle = false;
};



p._getRotateCursor = function (mx, my) {

    var r = Math.atan2(my - this._pOrigin.y, mx - this._pOrigin.x) / Math.PI * 180;
    return 'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" ><path transform="rotate('+r+', 16, 16)" d="M18.907 3.238l-7.54-2.104s8.35 3.9 8.428 15.367c.08 11.794-7.807 14.49-7.807 14.49l7.363-1.725" stroke="#000" stroke-width="2.054" fill="none"/></svg>\') 16 16, auto';
};

p._getScaleCursor = (function () {

    var FINGERS = ['0100', '0110', '0010', '0011', '0001', '1001', '1000', '1100'];

    return function () {

        var rBase = FINGERS.indexOf(this._finger) * 45;

        var r = rBase + (this._params.rz / Math.PI * 180);
        return 'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path transform="rotate('+r+', 16, 16)" d="M22.406 12.552l5.88 4.18H3.677l5.728 4.36" stroke="#000" stroke-width="2.254" fill="none"/></svg>\') 16 16, auto';
    };
}());


module.exports = Transformer;




//utils/////////////////////////////////////////////////////

function radDiff(r0, r1) {

    r0 %= Math.PI;
    r1 %= Math.PI;
    r0 += Math.PI;
    r1 += Math.PI;

    return r1 - r0;
}

function sqr(x) { 
    return x * x;
}

function dist2(v, w) { 
    return sqr(v.x - w.x) + sqr(v.y - w.y);
}

function distToSegmentSquared(p, v, w) {
  var l2 = dist2(v, w);
    
  if (l2 === 0) return dist2(p, v);
    
  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    
  if (t < 0) return dist2(p, v);
  if (t > 1) return dist2(p, w);
    
  return dist2(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
}

function distToSegment(p, v, w) { 
    return Math.sqrt(distToSegmentSquared(p, v, w));
}

function distToPointInAngle(p0, p1, rad) {

    var dx = p1.x - p0.x,
        dy = p1.y - p0.y,
        d = Math.sqrt(dx*dx + dy*dy),
        mRad = Math.atan2(dy, dx);

    rad = mRad - rad;

    // console.log('dx', dx, 'dy', dy, 'd', d, 'mRad', mRad, 'rad', rad, 'return', Math.cos(rad) * d)

    return Math.cos(rad) * d;

}

function isInside(point, vs) {
    // ray-casting algorithm based on
    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
    
    var x = point.x, y = point.y;
    
    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i].x, yi = vs[i].y;
        var xj = vs[j].x, yj = vs[j].y;
        
        var intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    
    return inside;
}

},{"events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js","lodash":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\lodash\\dist\\lodash.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\warehouseman\\Warehouseman.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var WebStorageman = require('./storages/WebStorageman');
var PageScript = require('./storages/PageScript');
var Download = require('./storages/Download');
var decorDialog = require('./decorDialog');

function Warehouseeman(opt) {

    EventEmitter.call(this);

    decorDialog(this);

    opt = opt || {};

    this._storages = [];
    this.addStorage(new PageScript());
    this.addStorage(new WebStorageman());
    this.addStorage(new Download());
    // this.addStorage(new Copy());
    this.addStorage({icon: 'hdd', tooltip: 'local file system'});
    this.addStorage({icon: 'git', tooltip: 'Git'});
    this.addStorage({icon: 'evernote', tooltip: 'Evernote'});
    this.addStorage({icon: 'dropbox', tooltip: 'Dropbox'});
    this.addStorage({icon: 'history', tooltip: 'auto save'});

    this.selectStorage(this._storages[2]);
}

inherits(Warehouseeman, EventEmitter);
var p = Warehouseeman.prototype;

p.addStorage = function (storage) {

    storage.features = storage.features || {
        placeholder: true,
    };

    this._storages.push(storage);
    this.emit('changeStorages');
};

p.selectStorage = function (storage) {

    if (this._currStorage === storage) {
        return;
    }

    this._currStorage = storage;

    if (storage.features.placeholder) {

        am.dialogs.featureDoesntExist.show();
    }

    this.emit('changeCurrStorage');
};

p.save = function (name, data, path) {

    return this._currStorage.save(name, data, path);
};

p.load = function (name, path   ) {

    return this._currStorage.load(name, path);
};

p.mkdir = function (path) {

    return this._currStorage.mkdir(path);
};

p.dir = function (path) {

    return this._currStorage.dir(path);
};

module.exports = Warehouseeman;


},{"./decorDialog":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\warehouseman\\decorDialog.js","./storages/Download":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\warehouseman\\storages\\Download.js","./storages/PageScript":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\warehouseman\\storages\\PageScript.js","./storages/WebStorageman":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\warehouseman\\storages\\WebStorageman.js","events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\warehouseman\\decorDialog.js":[function(require,module,exports){
'use strict';

var amgui = require('../amgui');

function decorDialog(whm) {

    var dialog, deRoot, deLeft, deHead, deBreadcrumbs, inpName, 
        deStorageSelector, deDirectory, btnNewFolder, isInited, deOptions,
        selectedPath = '', selectedName = '', selectedData = '',
        openOptions = {}, mode;



    whm.showSaveDialog = function(opt) {

        init();

        openOptions = opt;
        mode = 'save';

        selectedName = opt.name || '';
        selectedData = opt.data || '';
        selectedPath = opt.path || '';

        inpName.style.display = 'block';

        dialog.setTitle('Save');
        dialog.setButtons(['save', 'close']);
        deStorageSelector.refresh();
        refresh();
        dialog.showModal();
    };

    whm.showOpenDialog = function(opt) {

        init();

        openOptions = opt;
        mode = 'open';

        selectedName = opt.name || '';
        selectedPath = opt.path || '';

        inpName.style.display = 'none';

        dialog.setTitle('Open');
        dialog.setButtons(['open', 'close']);
        deStorageSelector.refresh();
        refresh();
        dialog.showModal();
    };

    whm.setSaveOtions = function (opt) {

        deOptions.setOptions(opt);
    };

    whm.getSaveOptions = function () {

        return deOptions.getOptions();
    };

    function feature(name) {

        return whm._currStorage.features &&
            whm._currStorage.features[name];
    }


    function onChangeCurrStorage() {

        refresh();
    }

    function refresh() {

        deBreadcrumbs.refresh();
        deDirectory.refresh();
        deStorageSelector.refreshSelection();
        inpName.refresh();

        showHide(deDirectory, feature('browse'));
        showHide(deBreadcrumbs, feature('browse'));
        showHide(btnNewFolder, feature('mkdir'));

        function showHide(de, show) {

            de.style.display = show ? 'block' || de.baseDisplay : 'hidden';
        }
    }

    function init () {

        if (isInited) {
            return;
        }
        isInited = true;

        createDialog();
        createStorageSelector();
        createBreadcrumbs();
        createBtnNewFolder();
        createBtnSettings();
        createNameInput();
        createDirectory();
        createOptions();

        whm.on('changeCurrStorage', onChangeCurrStorage);
    }

    function onSave() {

        var save = openOptions.getSave(),
            name = selectedName || 'anim.am.js';

        whm.save(name, save, selectedPath);

        onClose();
    }

    function onOpen() {

        var save = whm.load(selectedName, selectedPath);

        if (openOptions.onOpen) {

            openOptions.onOpen(save);
        }

        onClose();
    }

    function onClose() {

        dialog.close();
    }









    function createDialog () {

        deRoot = document.createElement('div');
        deRoot.style.width = '700px';
        deRoot.style.height = '400px';
        deRoot.style.display = 'flex';
        deRoot.style.color = 'white';

        deLeft = document.createElement('div');
        deLeft.style.height = '100%';
        deLeft.style.flex = '1';
        deLeft.style.display = 'flex';
        deLeft.style.flexDirection = 'column';
        deRoot.appendChild(deLeft);

        deHead = document.createElement('div');
        deHead.style.width = '100%';
        deHead.style.height = '21px';
        deHead.style.display = 'flex';
        deLeft.appendChild(deHead);

        dialog = amgui.createDialog({
            content: deRoot,
            parent: am.deDialogCont
        });

        dialog.addEventListener('click_save', onSave);
        dialog.addEventListener('click_open', onOpen);
        dialog.addEventListener('click_close', onClose);
    }


    function createBreadcrumbs() {

        deBreadcrumbs = document.createElement('div');
        deBreadcrumbs.style.display = 'inline-block';
        deBreadcrumbs.style.flex = '1';
        deHead.appendChild(deBreadcrumbs);

        deBreadcrumbs.addEventListener('click', function () {

            if (this.crambValue) {

                whm.cd(this.crambValue);
            }
        });

        deBreadcrumbs.refresh = function () {

            var crumbs = selectedPath.split('/').filter(Boolean),
                value = '';

            deBreadcrumbs.innerHTML = '';
            
            createCrumb((whm._currStorage.rootName || 'root') + '://', value);

            crumbs.forEach(function (crumbName) {

                value += crumbName + '/';
                createCrumb(crumbName, value);
                createSlash();
            });
        };

        function createSlash() {

            var deSlash = createLi(' / ');
            deSlash.style.pointerEvents = 'none';

            return deSlash;
        }

        function createCrumb(content, value) {

            var deChrumb = createLi(content);
            deChrumb.style.pointerEvents = 'none';
            deChrumb.crumbValue = value;

            return deChrumb;
        }
  
        function createLi(content) {

            var li = document.createElement('span');
            li.textContent = content;

            deBreadcrumbs.appendChild(li);

            return li;
        }
    }



    function createBtnSettings() {

        btnNewFolder = amgui.createIconBtn({
            parent: deHead,
            icon: 'wrench',
            width: 21,
            onClick: function () {
                deOptions.toggle();
            }
        });
    }



    function createBtnNewFolder() {

        btnNewFolder = amgui.createIconBtn({
            parent: deHead,
            icon: 'folder-add',
            width: 21
        });
    }

    function createNameInput() {

        inpName = document.createElement('input');
        inpName.type = 'text';
        inpName.style.width = '100%';
        inpName.style.height = '21px';
        inpName.style.background = 'none';
        inpName.style.border = 'none';
        inpName.style.color = amgui.color.text;
        inpName.style.fontSize = amgui.FONT_SIZE;
        inpName.style.fontFamily = amgui.FONT_FAMILY;
        inpName.placeholder = 'File name';
        deLeft.appendChild(inpName);

        inpName.addEventListener('change', function () {

            selectedName = inpName.value;
        });

        inpName.refresh = function () {

            if (inpName.value !== selectedName) {

                inpName.value = selectedName;
            }
        };
    }


    function createDirectory() {

        deDirectory = document.createElement('div');
        deDirectory.style.listStyle = 'none';
        deDirectory.style.display = 'inline-block';
        deDirectory.style.width = '100%';
        deDirectory.style.flex = '1';
        deLeft.appendChild(deDirectory);

        deDirectory.refresh = function () {

            deDirectory.innerHTML = '';

            if (!feature('browse')) {
                return;
            }

            var list = whm.dir();

            list.forEach(function (item) {

                createItem(item.name, item.type);
            });
        };
  
        function createItem(name, type) {

            var deItem = document.createElement('div');
            deItem._value = name;
            
            amgui.createIcon({
                icon: type === 'folder' ? 'folder-empty' : 'doc',
                parent: deItem,
                display: 'inline-block'
            });

            var deName = document.createElement('span');
            deName.textContent = name;
            deItem.appendChild(deName);

            deDirectory.appendChild(deItem);

            deItem.addEventListener('click', onClick);
            deItem.addEventListener('dblclick', onClick);
            deItem.addEventListener('mouseover', onMOver);
            deItem.addEventListener('mouseout', onMOut);

            return deItem;
        }

        function onClick(e) {
            
            selectedName = this._value;

            if (e.type === 'dblclick') {

                onOpen(selectedPath, selectedName);
            }
        }

        function onMOver() {
            
            this.style.background = amgui.color.bgHover;
        }

        function onMOut() {

            this.style.background = 'none';
        }
    }




    function createStorageSelector() {

        var btnSize = 52, buttons = [];

        deStorageSelector = document.createElement('div');
        deStorageSelector.style.display = 'inline-block';
        deStorageSelector.style.width = btnSize + 'px';
        deStorageSelector.style.height = '100%';
        deRoot.insertBefore(deStorageSelector, deLeft);

        deStorageSelector.addEventListener('click', function (e) {

            var idx = e.target._storageIdx;
            
            if (idx !== undefined) {

                whm.selectStorage(whm._storages[idx]);
            }
        });

        function removeButtons() {

            buttons.forEach(function (btn) {

                if (btn.domElem.parentNode) {
                    btn.domElem.parentNode.removeChild(btn.domElem);
                }

                btn.domElem.removeEventListener('click', onClickBtn);
            });
        }

        deStorageSelector.refresh = function () {

            removeButtons();

            whm._storages.forEach(function (storage) {

                if (storage.features.placeholder || storage.features[mode]) {

                    createItem(storage);
                }
            });

            deStorageSelector.refreshSelection();
        };

        deStorageSelector.refreshSelection = function () {

            buttons.forEach(function (btn) {

                if (btn.storage === whm._currStorage) {

                    btn.domElem.fixHighlight();
                }
                else {
                    btn.domElem.removeFixHighlight();
                }
            });
        };

        function onClickBtn(e) {

            buttons.forEach(function (btn) {

                if (btn.domElem === e.currentTarget) {

                    whm.selectStorage(btn.storage);
                }
            });
        }
  
        function createItem(storage) {

            var btn = {
                domElem: amgui.createIconBtn({
                    icon: storage.icon,
                    parent: deStorageSelector,
                    width: btnSize,
                    height: btnSize,
                    display: 'inline-block',
                    onClick: onClickBtn,
                }),
                storage: storage
            };

            amgui.addTooltip({
                deTarget: btn.domElem, 
                text: storage.tooltip
            });

            buttons.push(btn);
        }
    }

    function createOptions() {

        var isOpened = false;

        deOptions = document.createElement('div');
        deOptions.style.display = 'none';
        deOptions.style.width = '138px';
        deOptions.style.height = '100%';
        deRoot.appendChild(deOptions);

        var checkSave = createCheckbox('include save', true);
        var checkMinify = createCheckbox('minify');
        var checkAuto = createCheckbox('auto play', true);

        deOptions.getOptions = function () {

            return {
                includeSave: checkSave.checked,
                minify: checkMinify.checked,
                autoPlay: checkAuto.checked
            };
        };

        deOptions.setOptions = function (opt) {

            checkSave.checked = opt.includeSave;
            checkMinify.checked = opt.minify;
            checkAuto.checked = opt.autoPlay;
        };

        deOptions.toggle = function () {

            isOpened = !isOpened;

            deOptions.style.display = isOpened ? 'block' : 'none';
        };

        function createCheckbox(name, checked) {

            var de = document.createElement('div');
            deOptions.appendChild(de);

            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = checked;
            de.appendChild(cb);
            
            var label = document.createElement('label');
            label.style.color = amgui.color.text;
            label.textContent = name;
            de.appendChild(label);

            return cb;
        }
    }
}


module.exports = decorDialog;


},{"../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\warehouseman\\storages\\Download.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');

function Download(opt) {

    EventEmitter.call(this);

    opt = opt || {};

    this._root = opt.root || '_Download/';

    this.icon = 'download';
    this.tooltip = 'Download';
}

inherits(Download, EventEmitter);
var p = Download.prototype;

p.features = {
    save: true,
};

p.save = function (name, data) {

    data = 'data:application/javascript;charset=utf-8,' + encodeURIComponent(data);
    $('<a download="' + name + '" href="' + data + '"></a>')[0].click();
};

module.exports = Download;
},{"events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\warehouseman\\storages\\PageScript.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');

var FOLDERS = '<folders>';

function PageScript(opt) {

    EventEmitter.call(this);

    opt = opt || {};

    this._root = opt.root || '_PageScript/';

    this.icon = 'code';
    this.tooltip = 'running Animachine pagescripts';

    this._folders = window.localStorage.getItem(this._root + FOLDERS);
    
    try { 
        this.folders = JSON.parse(this._folders); 
    }
    catch (e) {
        this._folders = [];
    }
}

inherits(PageScript, EventEmitter);
var p = PageScript.prototype;

p.save = function (name, data, path) {

    name = this._validName(name);
    
    this.mkdir(path);
    this._set(path + name, data);

    return name;
};

p.open = function (name) {

    if (name in pageScripts()) {

        return pageScripts()[name];
    }
};

p.dir = function () {

    var ret = [];

    Object.keys(pageScripts()).forEach(function (key) {

        ret.push({
            name: key,
            type: 'file'
        });
    });

    return ret;
};

function pageScripts() {

    return (window.am && window.am.pageScripts) || [];
}

module.exports = PageScript;
},{"events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\warehouseman\\storages\\WebStorageman.js":[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');

var ROOT = '_webstorageman/', 
    FOLDERS = '<folders>';

function WebStorageman(opt) {

    EventEmitter.call(this);

    opt = opt || {};

    this.icon = 'bullseye';
    this.rootName = 'webstorage';
    this.tooltip = 'webstorage, store data in your browser';

    this._folders = window.localStorage.getItem(ROOT + FOLDERS);
    
    try { 
        this._folders = JSON.parse(this._folders); 
    }
    catch (e) {}

    if (!(this._folders instanceof Array)) {

        this._folders = [];
    } 
}

inherits(WebStorageman, EventEmitter);
var p = WebStorageman.prototype;

p.features = {
    save: true,
    open: true,
    browse: true,
};


p.save = function (name, data, path) {

    name = this._validName(name);
    path = this._validPath(path);
    
    this.mkdir(path);
    this._set(path + name, data);

    return name;
};

p.load = function (name, path) {

    name = this._validName(name);
    path = this._validPath(path);
    
    return this._get(path + name);
};

p.mkdir = function (path) {

    path = this._validPath(path).split('/').filter(Boolean);

    var folderPath = '';

    path.forEach(function (folder) {

        this._addFolder(folder + '/');

    }, this);
};

p.dir = function (path) {

    path = ROOT + this._validPath(path);

    var ret = [];

    Object.keys(window.localStorage).forEach(function (key) {

        if (key.indexOf(FOLDERS) === -1) {

            testKey(key, 'file');
        }
    });

    this._folders.forEach(function (path) {

        testKey(ROOT + path.slice(0, -1), 'folder');
    });

    return ret;

    function testKey(key, type) {

        if (key.indexOf(path) === 0) {

            key = key.substr(path.length);
            
            if (key.indexOf('/') === -1) {

                ret.push({
                    name: key,
                    type: type
                });
            }
        }
    }
};

p._addFolder = function(path) {

    if (this._folders.indexOf(path) !== -1) {
        return;
    }

    this._folders.push(path);

    window.localStorage.setItem(ROOT + FOLDERS, JSON.stringify(this._folders));
};

p._set = function(path, data) {

    return window.localStorage.setItem(ROOT + path, data);
};

p._get = function(path) {

    return window.localStorage.getItem(ROOT + path);
};

p._validPath = function(path) {

    if (!path) {
        path = '';
    }

    if (path.charAt(0) === '/') {
        path = path.substr(1);
    }

    if (path.charAt(path.length-1) !== '/' && path.length) {
        path += '/';
    }

    return path;
};

p._validName = function(name) {

    return name.replace(/<|\//g, '_');
};

module.exports = WebStorageman;
},{"events":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\events\\events.js","inherits":"c:\\Users\\Andras\\Downloads\\animachine\\node_modules\\inherits\\inherits_browser.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\windooman\\Container.js":[function(require,module,exports){
'use strict';

var Panel = require('./Panel');

function Container(opt) {

    this._createDomElem();

    this.direction = opt.direction || 'row';
    this._children = [];

    this.size = opt.size;
    this.scaleMode = opt.scaleMode;

    opt.children.forEach(function (cData) {

        if (cData.type === 'container') {

            this.addChild(new Container(cData));
        }
        else if (cData.type === 'panel') {

            this.addChild(new Panel(cData));
        }
    }, this);

    this._scaleChildren();
}

var p = Container.prototype;

Object.defineProperty(p, 'direction', {

    set: function (v) {

        this._direction = v;
        this.domElem.style.flexDirection = this._direction;
    },

    get: function () {

        return this._direction;
    }
});

p.addChild = function (child) {

    this._children.push(child);
    this.domElem.appendChild(child.domElem);

    this._scaleChildren();
};


p.findTab = function (name) {

    var tab;

    this._children.some(function (child) {

        tab = child.findTab(name);
        return tab;
    });

    return tab;
};

p._scaleChildren = function () {

    this._children.forEach(function (child) {

        var flex = '', width = '', height = ''; 

        if (child.scaleMode === 'fix') {

            if (this._direction.indexOf('row') === 0) {

                width = child.size + 'px'; 
            } else {
                height = child.size + 'px';
            }
        }
        else if (child.scaleMode === 'flex') {

            flex = child.size;
        }

        child.domElem.style.width = width;
        child.domElem.style.height = height;
        child.domElem.style.flex = flex;
    }, this);
};

p._createDomElem = function () {

    this.domElem = document.createElement('div');
    this.domElem.style.width = '100%';
    this.domElem.style.height = '100%';
    this.domElem.style.display = 'flex';
    this.domElem.style.alignItems = 'stretch';
    // this.domElem.style.pointerEvents = 'none';
};

module.exports = Container;
},{"./Panel":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\windooman\\Panel.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\windooman\\Panel.js":[function(require,module,exports){
'use strict';

var Tab = require('./Tab');
var amgui = require('../amgui');

function Panel(opt) {

    this._tabs = [];
    
    this.size = opt.size;
    this.scaleMode = opt.scaleMode;

    this._createDomElem();
    this._createTabBase();

    this._empty = false;
    this._collapsed = false;
    this._noHead = true;

    if ('empty' in opt) this.empty = opt.empty;
    if ('collapsed' in opt) this.collapsed = opt.collapsed;
    if ('noHead' in opt) this.noHead = opt.noHead;

    if (opt.tabs) {
        opt.tabs.forEach(this.addTab, this);
    }

    if (!this._tabs.some(function (tab) {return tab.selected;}) &&
        this._tabs.length)
    {
        this._tabs[0].select();
    }
}

var p = Panel.prototype;

Object.defineProperties(p, {

    empty: {
        set: function (v) {

            v = !!v;
            if (this._empty === v) return;

            this._empty = v;
            this.domElem.style.pointerEvents = this._empty ? 'none' : 'auto';
            this.domElem.style.visibility = this._empty ? 'hidden' : 'visibile';
        },
        get: function () {
            return this._empty;
        }
    },
    
    collapsed: {
        set: function (v) {

            v = !!v;
            if (this._collapsed === v) return;

            this._collapsed = v;
            this._deTabBase.style.display = this._collapsed ? 'none' : 'flex';
        },
        get: function () {
            return this._collapsed;
        }
    },
    
    noHead: {
        set: function (v) {

            v = !!v;
            if (this._noHead === v) return;

            this._noHead = v;
            this._deTabHead.style.display = this._noHead ? 'none' : 'flex';
        },
        get: function () {
            return this._noHead;
        }
    }
});

p.addTab = function (tData) {

    var tab = new Tab(tData);
    this._deTabHead.appendChild(tab.deEar);
    this._deTabContent.appendChild(tab.domElem);
    this._tabs.push(tab);
};


p.findTab = function (name) {

    var tab;

    this._tabs.some(function (t) {

        if (t.name === name) {

            return (tab = t);
        }
    });

    return tab;
};

p.showTab = function (tab) {

    this._tabs.forEach(function (t) {
        
        if (tab === t) {
            t.select();
        }
        else {
            t.deselect();
        }
    });
};

p._createDomElem = function () {

    this.domElem = document.createElement('div');
    this.domElem.style.width = '100%';
    this.domElem.style.height = '100%';
};

p._createTabBase = function () {

    this._deTabBase = document.createElement('div');
    this._deTabBase.style.width = '100%';
    this._deTabBase.style.height = '100%';
    this._deTabBase.style.display = 'flex';
    this._deTabBase.style.flexDirection = 'column';
    this.domElem.appendChild(this._deTabBase);

    this._deTabHead = document.createElement('div');
    this._deTabHead.style.width = '100%';
    this._deTabHead.style.height = '23px';
    this._deTabHead.style.display = 'flex';
    this._deTabHead.style.alignItems = 'stretch';
    this._deTabHead.style.background = amgui.color.bg1;
    if (this._showHead) {
        this._deTabBase.appendChild(this._deTabHead);
    }

    this._deTabContent = document.createElement('div');
    this._deTabContent.style.width = '100%';
    this._deTabContent.style.flex = 1;
    this._deTabBase.appendChild(this._deTabContent);
};

module.exports = Panel;
},{"../amgui":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\amgui\\amgui.js","./Tab":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\windooman\\Tab.js"}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\windooman\\Tab.js":[function(require,module,exports){
'use strict';

function Tab(opt) {

    this.name = opt.name;
    this.selected = opt.selected;

    this._createDomElem();
    this.deEar = this._createTabEar();

    this[this.selected ? 'select' : 'deselect']();
}

var p = Tab.prototype;

p.setContent = function (deContent) {

    this.domElem.innerHTML = '';
    this.domElem.appendChild(deContent);
};

p.select = function () {

    this.domElem.style.display = 'block';
    this.deEar.style.borderBottomWidth = '2px';
};

p.deselect = function () {

    this.domElem.style.display = 'none';
    this.deEar.style.borderBottomWidth = '1px';
};

p._createDomElem = function () {

    this.domElem = document.createElement('div');
    this.domElem.style.width = '100%';
    this.domElem.style.height = '100%';
    this.domElem.style.background = 'rgba(0,0,0,0.3)';
    this.domElem.style.pointerEvents = 'auto';
};

p._createTabEar = function () {

    var de = document.createElement('div');
    de.textContent = this.name;
    de.style.flex = 1;
    de.style.boxSizing = 'border-box';
    de.style.borderBottom = 'solid 1px white';
    de.style.alignItems = 'stretch';

    return de;
};

module.exports = Tab;
},{}],"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\windooman\\Windooman.js":[function(require,module,exports){
'use strict';

var Container = require('./Container');

function Windooman() {

    this._tabMap = {};
    this._workspaces = {};

    this._createDomElem();
}

var p = Windooman.prototype;

p.loadWorkspaces = function (workspaces) {

    Object.keys(workspaces).forEach(function (name) {

        this._workspaces[name] = workspaces[name];
    }, this);
};

p.load = function (name) {

    var map = this._workspaces[name];

    if (!map || map.type !== 'container') {
        throw Error('can\'t load ' + map);
    }

    this._root = new Container(map);
    
    this.domElem.innerHTML = '';
    this.domElem.appendChild(this._root.domElem);

    Object.keys(this._tabMap).forEach(function (name) {

        this.placeTab(name, this._tabMap[name]);
    }, this);
};

p.findTab = function (name) {

    if (this._root) {

        return this._root.findTab(name);
    }
};

p.fillTab = function (name, content) {

    this._tabMap[name] = content;

    var tab = this.findTab(name);

    if (tab) {
        tab.setContent(content);
    }
};

p._createDomElem = function () {

    this.domElem = document.createElement('div');
    this.domElem.style.width = '100%';
    this.domElem.style.height = '100%';
};

module.exports = Windooman;
},{"./Container":"c:\\Users\\Andras\\Downloads\\animachine\\src\\editor\\windooman\\Container.js"}]},{},["./src/editor/main.js"])