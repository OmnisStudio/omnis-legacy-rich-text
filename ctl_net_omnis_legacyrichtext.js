/**
 * Copyright (C) Omnis Software Ltd 2017
 *
 * An implementation of the Rich Text Editor used in the JS client prior to Studio 8.0 (and the move to Quill JS).
 */


/**
 * Copyright (c) 2007-2008 Brian Kirchoff (http://nicedit.com). Permission is hereby granted, free of charge, to any
 * person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE
 * AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */


ctrl_net_omnis_legacyrichtext.prototype = (function () {
    /****** CONSTANTS ******/
    var PROPERTIES = {
        plaintextname: "$plaintextname",
        showcontrols: "$showcontrols",
        autoscroll: "$autoscroll"
    };

    /** The control prototype - inherited from base class prototype */
    var ctrl = new ctrl_base();

    /**
     * class initialization, must be called by constructor
     * this function should initialize class variables
     * IMPORTANT:
     * initialization is separated out from the constructor
     * as the base class constructor is not called when a
     * class is subclassed.
     * all subclass constructors must call their own
     * init_class_inst function which in turn must call the
     * superclass.init_class_inst function
     */
    ctrl.init_class_inst = function () {
        // install superclass prototype so we can than call superclass methods
        // using this.superclass.method_name.call(this[,...])
        this.superclass = ctrl_base.prototype;

        // call our superclass class initializer
        this.superclass.init_class_inst.call(this);
    };

    ctrl.delete_class_inst = function () {
        if (gNicEdit != null)
            gNicEdit.removeInstance(this.replacedId);
        this.superclass.delete_class_inst.call(this); // Call superclass version to perform standard deletion procedure.
    };

    /**
     * Initializes the control instance from element attributes.
     * Must be called after control is constructed by the constructor.
     * @param form      Reference to the parent form.
     * @param elem      The html element the control belongs to.
     * @param rowCtrl   Pointer to a complex grid control if this control belongs to a cgrid.
     * @param rowNumber The row number this control belongs to if it belongs to a cgrid.
     * @returns {boolean}   True if the control is a container.
     */
    ctrl.init_ctrl_inst = function (form, elem, rowCtrl, rowNumber) {
        // call our superclass init_ctrl_inst
        this.superclass.init_ctrl_inst.call(this, form, elem, rowCtrl, rowNumber);

        //Control-specific initialization:
        var client_elem = this.getClientElem();
        var dataprops = client_elem.getAttribute('data-props');
        var datapropsobj = JSON.parse(dataprops);


        this.showControls = datapropsobj.showcontrols;
        this.autoScroll = datapropsobj.autoscroll;
        this.plainName = dataprops.plaintextname;
        this.plainNameIndex = -1;

        // assign the methods for our events
        var eventFunc = this.mEventFunction;
        client_elem.style.resize = "none"; // our text areas must not have grow handles

        // Create nicEdit control
        if (!gNicEdit)
            gNicEdit = new nicEditor();
        // Create a panel instance for this control:
        var replacedElem = document.createElement('textarea');
        replacedElem.id = this.clientElem.id + "_panel";
        replacedElem.style.width = replacedElem.style.height = "100%";
        this.clientElem.appendChild(replacedElem);
        this.replacedId = client_elem.firstChild.id;

        gNicEdit.panelInstance(this.replacedId, null, false, this);
        this.panelElem = this.elem.children[0].children[0];		// The panel (controls) element
        this.panelElem.style.display = this.showControls ? "block" : "none";

        this.editorElem = client_elem.children[1].children[0];	// The nicEdit text entry field
        this.editorElem.style.backgroundColor = client_elem.style.backgroundColor;
        this.editorElem.style.fontFamily = client_elem.style.fontFamily;
        this.editorElem.style.fontSize = client_elem.style.fontSize;
        client_elem.style.overflow = "hidden";
        this.editorElem.style.overflow = this.autoScroll ? "auto" : "hidden";
        this.editorElem.style.outline = "none";
        this.editorElem.onblur = eventFunc;
        this.editorElem.onkeyup = eventFunc;
        this.editorElem.onpaste = eventFunc;
        this.editorElem.oncut = eventFunc;

        this.editorElem.parentNode.style.borderTopWidth = this.showControls ? "0px" : "1px";
        this.editorElem.parentNode.style.borderTopStyle = "solid";
        this.editorElem.parentNode.style.borderTopColor = this.editorElem.parentNode.style.borderLeftColor;


        this.update();
        this.enabledChanged();

        // return true if our control is a container and the
        // children require installing via this.form.InstallChildren
        return false
    };

    ctrl.translate = function (id, defaultValue, replaceSpaces) {
        var form = this.form;
        if (form && form.stringTable) {
            var param = {"text": "$st.rt_" + id.toLowerCase()};
            if (form.stringTable.translateParam(param, "text") && param.text.length > 0) {
                if (replaceSpaces) {
                    return param.text.replace(/ /g, '&nbsp;');
                }
                return param.text;
            }
        }
        return defaultValue;
    };

    /**
     * The control's data has changed. The contents may need to be updated.
     *
     * @param {String} what    Specifies which part of the data has changed:
     *                 ""              - The entire data has changed
     *                 "#COL"          - A single column in the $dataname list (specified by 'row' and 'col') or a row's column (specified by 'col')
     *                 "#LSEL"         - The selected line of the $dataname list has changed (specified by 'row')
     *                 "#L"            - The current line of the $dataname list has changed  (specified by 'row')
     *                 "#LSEL_ALL"     - All lines in the $dataname list have been selected.
     *                 "#NCELL"        - An individual cell in a (nested) list. In this case, 'row' is an array of row & column numbers.
     *                                  of the form "row1,col1,row2,col2,..."
     *
     * @param {Number} row             If specified, the row number in a list (range = 1..n) to which the change pertains.
     *                                 If 'what' is "#NCELL", this must be an array of row and col numbers. Optionally, a modifier may be
     *                                 added as the final array element, to change which part of the nested data is to be changed. (Currently only "#L" is supported)
     *
     * @param {Number|String} col      If specified, the column in a list row (range = 1..n or name) to which the change pertains.
     */
    ctrl.updateCtrl = function (what, row, col, mustUpdate) {
        if (!this.getTrueVisibility()) {
            this.mNeedUpdate = true;
            return;
        }
        this.lastData = this.getData();
        this.setPlain(this.lastData);
        gNicEdit.instanceById(this.replacedId).setContent(this.lastData);
    };

    /**
     * This is called when an event registered using this.mEventFunction() is triggered.
     *
     * @param event The event object
     */
    ctrl.handleEvent = function (event) {
        switch (event.type) {
            case "keyup":
            case "blur":
            case "cut":
            case "paste":
            case "omnis-setdata": {
                var data = gNicEdit.instanceById(this.replacedId).getContent();
                if (this.lastData == null || data != this.lastData) {
                    this.lastData = data;
                    this.setData(data, null, null, null, "s");
                    // We do not support after events as we cannot do this reliably.
                    this.setPlain(data);
                }
                return true;
            }
            default: { // for all other events we call the super class
                return this.superclass.handleEvent.call(this, event);
            }
        }
    };

    /**
     * Called to get the value of an Omnis property
     *
     * @param propNumber    The Omnis property number
     * @returns {var}       The property's value
     */
    ctrl.getProperty = function (propNumber) {
        switch (propNumber) {
            case PROPERTIES.showcontrols:
                return this.showControls;
            case PROPERTIES.autoscroll:
                return this.autoScroll;
            case PROPERTIES.plaintextname:
                return this.plainName || "";
        }
        return this.superclass.getProperty.call(this, propNumber); // Let the superclass handle it,if not handled here.
    };

    /**
     * Function to get $canassign for a property of an object
     * @param propNumber    The Omnis property number
     * @returns {boolean}   Whether the passed property can be assigned to.
     */
    ctrl.getCanAssign = function (propNumber) {
        switch (propNumber) {
            case PROPERTIES.plaintextname:
            case PROPERTIES.showcontrols:
            case PROPERTIES.autoscroll:
                return true;
        }
        return this.superclass.getCanAssign.call(this, propNumber); // Let the superclass handle it,if not handled here.
    };

    /**
     * Assigns the specified property's value to the control.
     * @param propNumber    The Omnis property number
     * @param propValue     The new value for the property
     * @returns {boolean}   success
     */
    ctrl.setProperty = function (propNumber, propValue) {
        if (!this.getCanAssign(propNumber)) // check whether the value can be assigned to
            return false;

        var retVal;
        switch (propNumber) {

            case PROPERTIES.showcontrols:
                var old = this.showControls;
                this.showControls = (!!propValue);
                if (old != this.showControls) {
                    this.panelElem.style.display = this.showControls ? "block" : "none";
                    this.editorElem.parentNode.style.borderTopWidth = this.showControls ? "0px" : "1px";
                    this.sizeChanged();
                }
                retVal = true;
                break;

            case eBaseProperties.effect:
                retVal = this.superclass.setProperty.call(this, propNumber, propValue);
                this.editorElem.parentNode.style.border = this.getClientElem().style.border;
                this.sizeChanged();
                break;

            case eBaseProperties.backcolor:
            case eBaseProperties.backalpha:
                retVal = this.superclass.setProperty.call(this, propNumber, propValue);
                this.editorElem.style.backgroundColor = this.getClientElem().style.backgroundColor;
                break;

            case PROPERTIES.autoscroll:
                this.autoScroll = !!propValue;
                this.editorElem.style.overflow = this.autoScroll ? "auto" : "hidden";
                return true;

            case PROPERTIES.plaintextname:
                this.plainName = propValue;
                this.plainNameIndex = -1;
                this.setPlain(this.lastData);
                return true;

            default:
                return this.superclass.setProperty.call(this, propNumber, propValue); // Let the superclass handle it, if not handled here.
        }
        return retVal;
    };


    ctrl.enabledChanged = function () {
        var client_elem = this.getClientElem();
        client_elem.readOnly = !this.enabledProperty;
        if (this.editorElem) {
            this.editorElem.contentEditable = this.enabledProperty;
        }
        if (client_elem.readOnly) {
            // Append a div to prevent select events on the entry field from enabling the panel
            if (!this.disableDiv) {
                var div = document.createElement("DIV");
                div.style.position = client_elem.style.position;
                div.style.width = client_elem.style.width;
                div.style.height = client_elem.style.height;
                div.style.top = client_elem.style.top;
                div.style.left = client_elem.style.left;
                div.disabled = true;
                this.elem.appendChild(div);

                this.disableDiv = div;
            }
        }
        else {
            if (this.disableDiv) {
                this.elem.removeChild(this.disableDiv);
                this.disableDiv = null;
            }
        }
        this.superclass.enabledChanged.call(this);
    };

    ctrl.visibilityChanged = function () {
        // set our control visibility
        var ret = this.superclass.visibilityChanged.call(this);
        if (this.getTrueVisibility(null)) {
            if (this.mNeedUpdate) {
                this.update();
                this.sizeChanged(); // Also call sizeChanged, so that the toolbar panel will be (re)laid out.
                this.mNeedUpdate = false;
            }
        }

        return ret;
    };

    /**
     * Called when the size of the control has changed.
     */
    ctrl.sizeChanged = function () {
        this.superclass.sizeChanged.call(this);

        var client_elem = this.getClientElem();

        var wid = jOmnis.getOmnisWidth(this.elem);
        wid -= (2 * this.borderWidth + 1);
        client_elem.style.width = (wid + 1) + "px";
        client_elem.children[0].style.width = (wid - 1) + "px";
        client_elem.children[1].style.width = (wid - 1) + "px";
        this.editorElem.style.width = (wid + 1) + "px";

        var ph = this.elem.children[0].children[0].children[0].clientHeight;
        var ht = jOmnis.getOmnisHeight(this.elem);
        client_elem.style.height = (ht - 2 * this.borderWidth) + "px";
        var adj = (this.showControls ? 0 : 3) - 2 * this.borderWidth + 6;
        client_elem.children[1].style.height = (ht - ph - 5 + adj) + "px";
        this.editorElem.style.height = (ht - ph - 13 + adj + 5) + "px";
        this.editorElem.style.minHeight = 0;
        client_elem.children[1].style.borderWidth = 0;

        this.panelElem.style.top = 0;
        this.panelElem.style.position = "absolute";
        this.editorElem.style.top = (ph + 2) + "px";
        this.editorElem.style.position = "absolute";
    };


    ctrl.focus = function () {
        try {
            this.editorElem.focus();
        }
        catch (ignore) {
        }
    };


    ctrl.setPlain = function (data) {
        if (this.plainNameIndex === -1) {
            if (this.plainName && this.plainName.length)
                this.plainNameIndex = this.form.getDataIndex(this.plainName, this, false);
            if (this.plainNameIndex === -1)
                return;
        }
        if (this.dataName == this.plainName)	// Cannot use the same variable for both data and plain text
            return;

        var node = document.createElement("DIV");
        node.innerHTML = data;

        var normalize = function (a) {
            // clean up double line breaks and spaces
            if (!a) return "";
            return a.replace(/ +/g, " ")
                .replace(/[\t]+/gm, "")
                .replace(/[ ]+$/gm, "")
                .replace(/^[ ]+/gm, "")
                .replace(/\n+/g, "\n")
                .replace(/\n+$/, "")
                .replace(/^\n+/, "")
                .replace(/\nNEWLINE\n/g, "\n\n")
                .replace(/NEWLINE\n/g, "\n\n"); // IE
        };
        var removeWhiteSpace = function (node) {
            // getting rid of empty text nodes
            var isWhite = function (node) {
                return !(/[^\t\n\r ]/.test(node.nodeValue));
            };
            var ws = [];
            var findWhite = function (node) {
                for (var i = 0; i < node.childNodes.length; i++) {
                    var n = node.childNodes[i];
                    if (n.nodeType == 3 && isWhite(n)) {
                        ws.push(n)
                    } else if (n.hasChildNodes()) {
                        findWhite(n);
                    }
                }
            };
            findWhite(node);
            for (var i = 0; i < ws.length; i++) {
                ws[i].parentNode.removeChild(ws[i])
            }

        };
        var sty = function (n, prop) {
            // Get the style of the node.
            // Assumptions are made here based on tagName.
            if (n.style[prop]) return n.style[prop];
            var s = n.currentStyle || n.ownerDocument.defaultView.getComputedStyle(n, null);
            if (n.tagName === "SCRIPT") return "none";
            if (!s[prop]) return "LI,P,TR".indexOf(n.tagName) > -1 ? "block" : n.style[prop];
            if (s[prop] === "block" && n.tagName === "TD") return "feaux-inline";
            return s[prop];
        };

        var blockTypeNodes = "table-row,block,list-item";
        var isBlock = function (n) {
            // diaply:block or something else
            var s = sty(n, "display") || "feaux-inline";
            return blockTypeNodes.indexOf(s) > -1;

        };
        var recurse = function (n) {
            // Loop through all the child nodes
            // and collect the text, noting whether
            // spaces or line breaks are needed.
            if (/pre/.test(sty(n, "whiteSpace"))) {
                t += n.innerHTML
                    .replace(/\t/g, " ")
                    .replace(/\n/g, " "); // to match IE
                return "";
            }
            var s = sty(n, "display");
            if (s === "none") return "";
            var gap = isBlock(n) ? "\n" : " ";
            t += gap;
            for (var i = 0; i < n.childNodes.length; i++) {
                var c = n.childNodes[i];
                if (c.nodeType == 3) t += c.nodeValue;
                if (c.childNodes.length) recurse(c);
            }
            t += gap;
            return t;
        };
        // Line breaks aren't picked up by textContent
        node.innerHTML = node.innerHTML.replace(/<br>/g, "\n");

        // Double line breaks after P tags are desired, but would get
        // stripped by the final RegExp. Using placeholder text.
        var paras = node.getElementsByTagName("p");
        for (var i = 0; i < paras.length; i++) {
            paras[i].innerHTML += "NEWLINE";
        }

        var t = "";
        removeWhiteSpace(node);
        // Make the call!
        var plainText = normalize(recurse(node));
        this.form.setData(this.plainNameIndex, plainText);
    };

    return ctrl;
})();

/**
 * Constructor for our control.
 * @constructor
 */
function ctrl_net_omnis_legacyrichtext() {
    this.init_class_inst(); // initialize our class
}


// ###################################################################
// ##### NicEdit - modified source ###################################
// ###################################################################
/* NicEdit - Micro Inline WYSIWYG
 * Copyright 2007-2008 Brian Kirchoff
 *
 * NicEdit is distributed under the terms of the MIT license
 * For more information visit http://nicedit.com/
 * Do not remove this copyright message
 */
var bkExtend = function () {
    var args = arguments;
    if (args.length == 1) args = [this, args[0]];
    for (var prop in args[1]) args[0][prop] = args[1][prop];
    return args[0];
};

function bkClass() {
}

bkClass.prototype.construct = function () {
};
bkClass.extend = function (def) {
    var classDef = function () {
        if (arguments[0] !== bkClass) {
            return this.construct.apply(this, arguments);
        }
    };
    var proto = new this(bkClass);
    bkExtend(proto, def);
    classDef.prototype = proto;
    classDef.extend = this.extend;
    return classDef;
};

var bkElement = bkClass.extend({
    construct: function (elm, d) {
        if (typeof (elm) == "string") {
            elm = (d || document).createElement(elm);
        }
        elm = $BK(elm);
        return elm;
    },

    appendTo: function (elm) {
        elm.appendChild(this);
        return this;
    },

    appendBefore: function (elm) {
        elm.parentNode.insertBefore(this, elm);
        return this;
    },

    addEvent: function (type, fn) {
        bkLib.addEvent(this, type, fn);
        return this;
    },

    setContent: function (c) {
        this.innerHTML = c;
        return this;
    },

    pos: function () {
        var curleft = curtop = 0;
        var o = obj = this;
        if (obj.offsetParent) {
            do {
                curleft += obj.offsetLeft;
                curtop += obj.offsetTop;
            } while (obj = obj.offsetParent);
        }
        var b = (!window.opera) ? parseInt(this.getStyle('border-width') || this.style.border) || 0 : 0;
        return [curleft + b, curtop + b + this.offsetHeight];
    },

    noSelect: function () {
        bkLib.noSelect(this);
        return this;
    },

    parentTag: function (t) {
        var elm = this;
        do {
            if (elm && elm.nodeName && elm.nodeName.toUpperCase() == t) {
                return elm;
            }
            elm = elm.parentNode;
        } while (elm);
        return false;
    },

    hasClass: function (cls) {
        return this.className.match(new RegExp('(\\s|^)nicEdit-' + cls + '(\\s|$)'));
    },

    addClass: function (cls) {
        if (!this.hasClass(cls)) {
            this.className += " nicEdit-" + cls
        }
        return this;
    },

    removeClass: function (cls) {
        if (this.hasClass(cls)) {
            this.className = this.className.replace(new RegExp('(\\s|^)nicEdit-' + cls + '(\\s|$)'), ' ');
        }
        return this;
    },

    setStyle: function (st) {
        var elmStyle = this.style;
        for (var itm in st) {
            switch (itm) {
                case 'float':
                    elmStyle['cssFloat'] = elmStyle['styleFloat'] = st[itm];
                    break;
                case 'opacity':
                    elmStyle.opacity = st[itm];
                    elmStyle.filter = "alpha(opacity=" + Math.round(st[itm] * 100) + ")";
                    break;
                case 'className':
                    this.className = st[itm];
                    break;
                default:
                    //if(document.compatMode || itm != "cursor") { // Nasty Workaround for IE 5.5
                    elmStyle[itm] = st[itm];
                //}
            }
        }
        return this;
    },

    getStyle: function (cssRule, d) {
        var doc = (!d) ? document.defaultView : d;
        if (this.nodeType == 1)
            return (doc && doc.getComputedStyle) ? doc.getComputedStyle(this, null).getPropertyValue(cssRule) : this.currentStyle[bkLib.camelize(cssRule)];
    },

    remove: function () {
        if (this.parentNode) // rmm7752
            this.parentNode.removeChild(this);
        return this;
    },

    setAttributes: function (at) {
        for (var itm in at) {
            this[itm] = at[itm];
        }
        return this;
    }
});

var bkLib = {
    isMSIE: (navigator.appVersion.indexOf("MSIE") != -1),

    addEvent: function (obj, type, fn) {
        (obj.addEventListener) ? obj.addEventListener(type, fn, false) : obj.attachEvent("on" + type, fn);
    },

    toArray: function (iterable) {
        var length = iterable.length, results = new Array(length);
        while (length--) {
            results[length] = iterable[length]
        }
        return results;
    },

    noSelect: function (element) {
        if (element.setAttribute && element.nodeName.toLowerCase() != 'input' && element.nodeName.toLowerCase() != 'textarea') {
            element.setAttribute('unselectable', 'on');
        }
        for (var i = 0; i < element.childNodes.length; i++) {
            bkLib.noSelect(element.childNodes[i]);
        }
    },
    camelize: function (s) {
        return s.replace(/\-(.)/g, function (m, l) {
            return l.toUpperCase()
        });
    },
    inArray: function (arr, item) {
        return (bkLib.search(arr, item) != null);
    },
    search: function (arr, itm) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] == itm)
                return i;
        }
        return null;
    },
    cancelEvent: function (e) {
        e = e || window.event;
        if (e.preventDefault && e.stopPropagation) {
            e.preventDefault();
            e.stopPropagation();
        }
        return false;
    },
    domLoad: [],
    domLoaded: function () {
        if (arguments.callee.done) return;
        arguments.callee.done = true;
        for (i = 0; i < bkLib.domLoad.length; i++) bkLib.domLoad[i]();
    },
    onDomLoaded: function (fireThis) {
        this.domLoad.push(fireThis);
        if (document.addEventListener) {
            document.addEventListener("DOMContentLoaded", bkLib.domLoaded, null);
        }
        else if (bkLib.isMSIE) {
            document.write("<style>.nicEdit-main p { margin: 0; }</style><scr" + "ipt id=__ie_onload defer " + ((location.protocol == "https:") ? "src='javascript:void(0)'" : "src=//0") + "><\/scr" + "ipt>");
            $BK("__ie_onload").onreadystatechange = function () {
                if (this.readyState == "complete") {
                    bkLib.domLoaded();
                }
            };
        }
        window.onload = bkLib.domLoaded;
    }
};

function $BK(elm) {
    if (typeof (elm) == "string") {
        elm = document.getElementById(elm);
    }
    return (elm && !elm.appendTo) ? bkExtend(elm, bkElement.prototype) : elm;
}

var bkEvent = {
    addEvent: function (evType, evFunc) {
        if (evFunc) {
            this.eventList = this.eventList || {};
            this.eventList[evType] = this.eventList[evType] || [];
            this.eventList[evType].push(evFunc);
        }
        return this;
    },
    fireEvent: function () {
        var args = bkLib.toArray(arguments), evType = args.shift();
        if (this.eventList && this.eventList[evType]) {
            for (var i = 0; i < this.eventList[evType].length; i++) {
                this.eventList[evType][i].apply(this, args);
            }
        }
    }
};

function __(s) {
    return s;
}

Function.prototype.closure = function () {
    var __method = this, args = bkLib.toArray(arguments), obj = args.shift();
    return function () {
        if (typeof (bkLib) != 'undefined') {
            return __method.apply(obj, args.concat(bkLib.toArray(arguments)));
        }
    };
};

Function.prototype.closureListener = function () {
    var __method = this, args = bkLib.toArray(arguments), object = args.shift();
    return function (e) {
        e = e || window.event;
        if (e.target) {
            var target = e.target;
        }
        else {
            var target = e.srcElement
        }
        return __method.apply(object, [e, target].concat(args));
    };
};


/* START CONFIG */

var nicEditorConfig = bkClass.extend({
    buttons: {
        'bold': {name: __('Bold'), command: 'Bold', tags: ['B', 'STRONG'], css: {'font-weight': 'bold'}, key: 'b'},
        'italic': {name: __('Italic'), command: 'Italic', tags: ['EM', 'I'], css: {'font-style': 'italic'}, key: 'i'},
        'underline': {
            name: __('Underline'),
            command: 'Underline',
            tags: ['U'],
            css: {'text-decoration': 'underline'},
            key: 'u'
        },
        'left': {name: __('Left align'), command: 'justifyleft', noActive: true},
        'center': {name: __('Center align'), command: 'justifycenter', noActive: true},
        'right': {name: __('Right align'), command: 'justifyright', noActive: true},
        'justify': {name: __('Justify'), command: 'justifyfull', noActive: true},
        'ol': {name: __('Insert ordered list'), command: 'insertorderedlist', tags: ['OL']},
        'ul': {name: __('Insert unordered list'), command: 'insertunorderedlist', tags: ['UL']},
        'subscript': {name: __('Subscript'), command: 'subscript', tags: ['SUB']},
        'superscript': {name: __('Superscript'), command: 'superscript', tags: ['SUP']},
        'strikethrough': {
            name: __('Strike through'),
            command: 'strikeThrough',
            css: {'text-decoration': 'line-through'}
        },
        'removeformat': {name: __('Remove formatting'), command: 'removeformat', noActive: true},
        'indent': {name: __('Indent'), command: 'indent', noActive: true},
        'outdent': {name: __('Remove indent'), command: 'outdent', noActive: true},
        'hr': {name: __('Horizontal Rule'), command: 'insertHorizontalRule', noActive: true}
    },
    iconsPath: 'images/niceditoricons.gif',
    buttonList: ['save', 'bold', 'italic', 'underline', 'left', 'center', 'right', 'justify', 'ol', 'ul', 'subscript', 'superscript', 'strikethrough', 'removeformat', 'fontSize', 'fontFamily', 'fontFormat', 'indent', 'outdent', 'image', 'upload', 'forecolor', 'bgcolor'],	// rmm7752: ,'link','unlink'
    iconList: {
        "bgcolor": 1,
        "forecolor": 2,
        "bold": 3,
        "center": 4,
        "hr": 5,
        "indent": 6,
        "italic": 7,
        "justify": 8,
        "left": 9,
        "ol": 10,
        "outdent": 11,
        "removeformat": 12,
        "right": 13,
        "save": 24,
        "strikethrough": 15,
        "subscript": 16,
        "superscript": 17,
        "ul": 18,
        "underline": 19,
        "image": 20,
        "close": 23,
        "arrow": 25
    } // rmm7752: ,"link":21,"unlink":22
});
/* END CONFIG */


var nicEditors = {
    nicPlugins: [],
    editors: [],

    registerPlugin: function (plugin, options) {
        this.nicPlugins.push({p: plugin, o: options});
    },

    allTextAreas: function (nicOptions) {
        var textareas = document.getElementsByTagName("textarea");
        for (var i = 0; i < textareas.length; i++) {
            nicEditors.editors.push(new nicEditor(nicOptions).panelInstance(textareas[i]));
        }
        return nicEditors.editors;
    },

    findEditor: function (e) {
        var editors = nicEditors.editors;
        for (var i = 0; i < editors.length; i++) {
            if (editors[i].instanceById(e)) {
                return editors[i].instanceById(e);
            }
        }
    }
};


var nicEditor = bkClass.extend({
    construct: function (o) {
        this.options = new nicEditorConfig();
        bkExtend(this.options, o);
        this.nicInstances = [];
        this.loadedPlugins = [];

        var plugins = nicEditors.nicPlugins;
        for (var i = 0; i < plugins.length; i++) {
            this.loadedPlugins.push(new plugins[i].p(this, plugins[i].o));
        }
        nicEditors.editors.push(this);
        bkLib.addEvent(document.body, 'mousedown', this.selectCheck.closureListener(this));
    },

    panelInstance: function (e, o, useCss, omnisCtrl) { // rmm7752
        e = this.checkReplace($BK(e));
        var panelElm = new bkElement('DIV').setStyle({width: (parseInt(e.getStyle('width')) || e.clientWidth) + 'px'}).appendBefore(e);
        this.setPanel(panelElm, omnisCtrl); // rmm7752
        return this.addInstance(e, o, useCss, omnisCtrl); // rmm7752
    },

    checkReplace: function (e) {
        var r = nicEditors.findEditor(e);
        if (r) {
            r.removeInstance(e);
            r.removePanel();
        }
        return e;
    },

    addInstance: function (e, o, useCss, omnisCtrl)	// rmm7752
    {
        e = this.checkReplace($BK(e));
        if (e.contentEditable || !!window.opera) {
            var newInstance = new nicEditorInstance(e, o, this);
        }
        else {
            var newInstance = new nicEditorIFrameInstance(e, o, this);
        }
        newInstance.omnisCtrl = omnisCtrl;	// rmm7752
        this.nicInstances.push(newInstance);
        // Start rmm7752: control if CSS is used or not (not applicable to all browsers, and can only be set once)
        if (!this.setUseCSS) {
            this.setUseCSS = true;
            try {
                if (!document.execCommand("styleWithCSS", false, useCss)) {
                    // The value required by UseCSS is the inverse of what you'd expect
                    document.execCommand("UseCSS", false, !useCss);
                }
            }
            catch (ex) {
                // IE doesn't recognise these commands and throws.
            }
        }
        // End rmm7752
        return this;
    },

    removeInstance: function (e) {
        e = $BK(e);
        var instances = this.nicInstances;
        for (var i = 0; i < instances.length; i++) {
            if (instances[i].e == e) {
                instances[i].remove();
                this.nicInstances.splice(i, 1);
            }
        }
    },

    removePanel: function (e) {
        if (this.nicPanel) {
            this.nicPanel.remove();
            this.nicPanel = null;
        }
    },

    instanceById: function (e) {
        e = $BK(e);
        var instances = this.nicInstances;
        for (var i = 0; i < instances.length; i++) {
            if (instances[i].e == e) {
                return instances[i];
            }
        }
    },

    setPanel: function (e, omnisCtrl) // rmm7752
    {
        this.nicPanel = new nicEditorPanel($BK(e), this.options, this, omnisCtrl); // rmm7752
        this.fireEvent('panel', this.nicPanel);
        return this;
    },

    nicCommand: function (cmd, args) {
        if (this.selectedInstance) {
            this.selectedInstance.nicCommand(cmd, args);
        }
    },

    getIcon: function (iconName, options) {
        var icon = this.options.iconList[iconName];
        var file = (options.iconFiles) ? options.iconFiles[iconName] : '';
        return {
            backgroundImage: "url('" + ((icon) ? this.options.iconsPath : file) + "')",
            backgroundPosition: ((icon) ? ((icon - 1) * -18) : 0) + 'px 0px'
        };
    },

    selectCheck: function (e, t) {
        var found = false;
        do {
            if (t.className && typeof t.className === "string" && t.className.indexOf('nicEdit') != -1) {
                return false;
            }
        } while (t = t.parentNode);
        this.fireEvent('blur', this.selectedInstance, t);
        this.lastSelectedInstance = this.selectedInstance;
        this.selectedInstance = null;
        return false;
    }

});
nicEditor = nicEditor.extend(bkEvent);


var nicEditorInstance = bkClass.extend({
    isSelected: false,

    construct: function (e, options, nicEditor) {
        this.ne = nicEditor;
        this.elm = this.e = e;
        this.options = options || {};

        newX = parseInt(e.getStyle('width')) || e.clientWidth;
        newY = parseInt(e.getStyle('height')) || e.clientHeight;
        this.initialHeight = newY - 8;

        var isTextarea = (e.nodeName.toLowerCase() == "textarea");
        if (isTextarea || this.options.hasPanel) {
            var ie7s = (bkLib.isMSIE && !((typeof document.body.style.maxHeight != "undefined") && document.compatMode == "CSS1Compat"));
            var s = {width: newX + 'px', border: '1px solid #ccc', borderTop: 0}; // rmm7752
            s[(ie7s) ? 'height' : 'maxHeight'] = (this.ne.options.maxHeight) ? this.ne.options.maxHeight + 'px' : null;
            this.editorContain = new bkElement('DIV').setStyle(s).appendBefore(e);
            var editorElm = new bkElement('DIV').setStyle({
                width: (newX - 8) + 'px',
                minHeight: newY + 'px'
            }).addClass('main').appendTo(this.editorContain); // rmm7752

            e.setStyle({display: 'none'});

            editorElm.innerHTML = e.innerHTML;
            if (isTextarea) {
                editorElm.setContent(e.value);
                this.copyElm = e;
                var f = e.parentTag('FORM');
                if (f) {
                    bkLib.addEvent(f, 'submit', this.saveContent.closure(this));
                }
            }
            editorElm.setStyle((ie7s) ? {height: newY + 'px'} : {overflow: 'hidden'});
            this.elm = editorElm;
        }
        this.ne.addEvent('blur', this.blur.closure(this));

        this.init();
        this.blur();
    },

    init: function () {
        this.elm.setAttribute('contentEditable', 'true');
        if (this.getContent() == "") {
            this.setContent('<br />');
        }
        this.instanceDoc = document.defaultView;
        this.elm.addEvent('mousedown', this.selected.closureListener(this)).addEvent('keypress', this.keyDown.closureListener(this)).addEvent('focus', this.selected.closure(this)).addEvent('blur', this.blur.closure(this)).addEvent('keyup', this.selected.closure(this));
        this.ne.fireEvent('add', this);
    },

    remove: function () {
        this.saveContent();
        if (this.copyElm || this.options.hasPanel) {
            this.editorContain.remove();
            this.e.setStyle({'display': 'block'});
            this.ne.removePanel();
        }
        this.disable();
        this.ne.fireEvent('remove', this);
    },

    disable: function () {
        this.elm.setAttribute('contentEditable', 'false');
    },

    getSel: function () {
        return (window.getSelection) ? window.getSelection() : document.selection;
    },

    getRng: function () {
        var s = this.getSel();
        if (!s || s.rangeCount === 0) {
            return;
        }
        return (s.rangeCount > 0) ? s.getRangeAt(0) : s.createRange();
    },

    selRng: function (rng, s) {
        if (window.getSelection) {
            s.removeAllRanges();
            s.addRange(rng);
        }
        else {
            rng.select();
        }
    },

    selElm: function () {
        var r = this.getRng();
        if (!r) {
            return;
        }
        if (r.startContainer) {
            var contain = r.startContainer;
            if (r.cloneContents().childNodes.length == 1) {
                for (var i = 0; i < contain.childNodes.length; i++) {
                    var rng = contain.childNodes[i].ownerDocument.createRange();
                    rng.selectNode(contain.childNodes[i]);
                    if (r.compareBoundaryPoints(Range.START_TO_START, rng) != 1 &&
                        r.compareBoundaryPoints(Range.END_TO_END, rng) != -1) {
                        return $BK(contain.childNodes[i]);
                    }
                }
            }
            return $BK(contain);
        }
        else {
            return $BK((this.getSel().type == "Control") ? r.item(0) : r.parentElement());
        }
    },

    saveRng: function () {
        this.savedRange = this.getRng();
        this.savedSel = this.getSel();
    },

    restoreRng: function () {
        if (this.savedRange) {
            this.selRng(this.savedRange, this.savedSel);
        }
    },

    keyDown: function (e, t) {
        if (e.ctrlKey) {
            this.ne.fireEvent('key', this, e);
        }
    },

    selected: function (e, t) {
        if (!t && !(t = this.selElm)) {
            t = this.selElm();
        }
        if (!e.ctrlKey) {
            var selInstance = this.ne.selectedInstance;
            if (selInstance != this) {
                if (selInstance) {
                    this.ne.fireEvent('blur', selInstance, t);
                }
                this.ne.selectedInstance = this;
                this.ne.fireEvent('focus', selInstance, t);
            }
            this.ne.fireEvent('selected', selInstance, t);
            this.isFocused = true;
            this.elm.addClass('selected');
        }
        return false;
    },

    blur: function () {
        this.isFocused = false;
        this.elm.removeClass('selected');
    },

    saveContent: function () {
        if (this.copyElm || this.options.hasPanel) {
            this.ne.fireEvent('save', this);
            (this.copyElm) ? this.copyElm.value = this.getContent() : this.e.innerHTML = this.getContent();
        }
    },

    getElm: function () {
        return this.elm;
    },

    getContent: function () {
        this.content = this.getElm().innerHTML;
        this.ne.fireEvent('get', this);
        return this.content;
    },

    setContent: function (e) {
        this.content = e;
        this.ne.fireEvent('set', this);
        this.elm.innerHTML = this.content;
    },

    nicCommand: function (cmd, args) {
        document.execCommand(cmd, false, args);
    }
});

var nicEditorIFrameInstance = nicEditorInstance.extend({
    savedStyles: [],

    init: function () {
        var c = this.elm.innerHTML.replace(/^\s+|\s+$/g, '');
        this.elm.innerHTML = '';
        (!c) ? c = "<br />" : c;
        this.initialContent = c;

        this.elmFrame = new bkElement('iframe').setAttributes({
            'src': 'javascript:;',
            'frameBorder': 0,
            'allowTransparency': 'true',
            'scrolling': 'no'
        }).setStyle({height: '100px', width: '100%'}).addClass('frame').appendTo(this.elm);

        if (this.copyElm) {
            this.elmFrame.setStyle({width: (this.elm.offsetWidth - 4) + 'px'});
        }

        var styleList = ['font-size', 'font-family', 'font-weight', 'color'];
        for (itm in styleList) {
            this.savedStyles[bkLib.camelize(itm)] = this.elm.getStyle(itm);
        }

        setTimeout(this.initFrame.closure(this), 50);
    },

    disable: function () {
        this.elm.innerHTML = this.getContent();
    },

    initFrame: function () {
        var fd = $BK(this.elmFrame.contentWindow.document);
        fd.designMode = "on";
        fd.open();
        var css = this.ne.options.externalCSS;
        fd.write('<html><head>' + ((css) ? '<link href="' + css + '" rel="stylesheet" type="text/css" />' : '') + '</head><body id="nicEditContent" style="margin: 0 !important; background-color: transparent !important;">' + this.initialContent + '</body></html>');
        fd.close();
        this.frameDoc = fd;

        this.frameWin = $BK(this.elmFrame.contentWindow);
        this.frameContent = $BK(this.frameWin.document.body).setStyle(this.savedStyles);
        this.instanceDoc = this.frameWin.document.defaultView;

        this.heightUpdate();
        this.frameDoc.addEvent('mousedown', this.selected.closureListener(this)).addEvent('keyup', this.heightUpdate.closureListener(this)).addEvent('keydown', this.keyDown.closureListener(this)).addEvent('keyup', this.selected.closure(this));
        this.ne.fireEvent('add', this);
    },

    getElm: function () {
        return this.frameContent;
    },

    setContent: function (c) {
        this.content = c;
        this.ne.fireEvent('set', this);
        this.frameContent.innerHTML = this.content;
        this.heightUpdate();
    },

    getSel: function () {
        return (this.frameWin) ? this.frameWin.getSelection() : this.frameDoc.selection;
    },

    heightUpdate: function () {
        this.elmFrame.style.height = Math.max(this.frameContent.offsetHeight, this.initialHeight) + 'px';
    },

    nicCommand: function (cmd, args) {
        this.frameDoc.execCommand(cmd, false, args);
        setTimeout(this.heightUpdate.closure(this), 100);
    }


});
var nicEditorPanel = bkClass.extend({
    construct: function (e, options, nicEditor, omnisCtrl) // rmm7752
    {
        this.elm = e;
        this.options = options;
        this.ne = nicEditor;
        this.omnisCtrl = omnisCtrl;	// rmm7752
        this.panelButtons = [];
        this.buttonList = bkExtend([], this.ne.options.buttonList);

        this.panelContain = new bkElement('DIV').setStyle({
            overflow: 'hidden',
            width: '100%',
            border: '1px solid #cccccc',
            backgroundColor: '#efefef'
        }).addClass('panelContain');
        this.panelElm = new bkElement('DIV').setStyle({
            margin: '2px',
            marginTop: '0px',
            zoom: 1,
            overflow: 'hidden'
        }).addClass('panel').appendTo(this.panelContain);
        this.panelContain.appendTo(e);

        var opt = this.ne.options;
        var buttons = opt.buttons;
        var button;	// rmm7752
        for (button in buttons) {
            this.addButton(button, opt, true, omnisCtrl); // rmm7752
        }
        this.reorder();
        e.noSelect();
    },

    addButton: function (buttonName, options, noOrder, omnisCtrl) // rmm7752
    {
        var button = options.buttons[buttonName];
        var type = (button['type']) ? eval('(typeof(' + button['type'] + ') == "undefined") ? null : ' + button['type'] + ';') : nicEditorButton;
        var hasButton = bkLib.inArray(this.buttonList, buttonName);
        if (type && (hasButton || this.ne.options.fullPanel)) {
            // Start rmm7752
            if (!omnisCtrl) omnisCtrl = this.omnisCtrl;
            if (omnisCtrl && hasButton && button.command != "fontname" && button.command != "fontsize") {
                if (button.command) {
                    button.name = omnisCtrl.translate(button.command, button.name);
                }
                else {
                    var command = button.name.toLowerCase();
                    command = command.replace(/ /g, "");
                    button.name = omnisCtrl.translate(command, button.name);
                }
            }
            // End rmm7752
            this.panelButtons.push(new type(this.panelElm, buttonName, options, this.ne, omnisCtrl)); // rmm7752
            if (!hasButton) {
                this.buttonList.push(buttonName);
            }
        }
    },

    findButton: function (itm) {
        for (var i = 0; i < this.panelButtons.length; i++) {
            if (this.panelButtons[i].name == itm)
                return this.panelButtons[i];
        }
    },

    reorder: function () {
        var bl = this.buttonList;
        for (var i = 0; i < bl.length; i++) {
            var button = this.findButton(bl[i]);
            if (button) {
                this.panelElm.appendChild(button.margin);
            }
        }
    },

    remove: function () {
        this.elm.remove();
    }
});
var nicEditorButton = bkClass.extend({

    construct: function (e, buttonName, options, nicEditor, omnisCtrl) { // rmm7752
        this.options = options.buttons[buttonName];
        this.name = buttonName;
        this.ne = nicEditor;
        this.omnisCtrl = omnisCtrl;	// rmm7752
        this.elm = e;

        this.margin = new bkElement('DIV').setStyle({'float': 'left', marginTop: '2px'}).appendTo(e);
        this.contain = new bkElement('DIV').setStyle({
            width: '20px',
            height: '20px'
        }).addClass('buttonContain').appendTo(this.margin);
        this.border = new bkElement('DIV').setStyle({
            backgroundColor: '#efefef',
            border: '1px solid #efefef'
        }).appendTo(this.contain);
        this.button = new bkElement('DIV').setStyle({
            width: '18px',
            height: '18px',
            overflow: 'hidden',
            zoom: 1,
            cursor: 'pointer'
        }).addClass('button').setStyle(this.ne.getIcon(buttonName, options)).appendTo(this.border);
        this.button.addEvent('mouseover', this.hoverOn.closure(this)).addEvent('mouseout', this.hoverOff.closure(this)).addEvent('mousedown', this.mouseClick.closure(this)).noSelect();

        if (!window.opera) {
            this.button.onmousedown = this.button.onclick = bkLib.cancelEvent;
        }

        this.button.title = this.options.name;	// rmm7752

        nicEditor.addEvent('selected', this.enable.closure(this)).addEvent('blur', this.disable.closure(this)).addEvent('key', this.key.closure(this));

        this.disable();
        this.init();
    },

    init: function () {
    },

    hide: function () {
        this.contain.setStyle({display: 'none'});
    },

    updateState: function () {
        if (this.isDisabled) {
            this.setBg();
        }
        else if (this.isHover) {
            this.setBg('hover');
        }
        else if (this.isActive) {
            this.setBg('active');
        }
        else {
            this.setBg();
        }
    },

    setBg: function (state) {
        switch (state) {
            case 'hover':
                var stateStyle = {border: '1px solid #666', backgroundColor: '#ddd'};
                break;
            case 'active':
                var stateStyle = {border: '1px solid #666', backgroundColor: '#ccc'};
                break;
            default:
                var stateStyle = {border: '1px solid #efefef', backgroundColor: '#efefef'};
        }
        this.border.setStyle(stateStyle).addClass('button-' + state);
    },

    checkNodes: function (e) {
        var elm = e;
        do {
            if (this.options.tags && bkLib.inArray(this.options.tags, elm.nodeName)) {
                this.activate();
                return true;
            }
        } while (elm = elm.parentNode && !jOmnis.hasClass(elm, "nicEdit"));
        elm = $BK(e);
        while (elm.nodeType == 3) {
            elm = $BK(elm.parentNode);
        }
        if (this.options.css) {
            for (itm in this.options.css) {
                if (elm.getStyle(itm, this.ne.selectedInstance.instanceDoc) == this.options.css[itm]) {
                    this.activate();
                    return true;
                }
            }
        }
        this.deactivate();
        return false;
    },

    activate: function () {
        if (!this.isDisabled) {
            this.isActive = true;
            this.updateState();
            this.ne.fireEvent('buttonActivate', this);
        }
    },

    deactivate: function () {
        this.isActive = false;
        this.updateState();
        if (!this.isDisabled) {
            this.ne.fireEvent('buttonDeactivate', this);
        }
    },

    enable: function (ins, t) {
        this.isDisabled = false;
        this.contain.setStyle({'opacity': 1}).addClass('buttonEnabled');
        this.updateState();
        this.checkNodes(t);
    },

    disable: function (ins, t) {
        this.isDisabled = true;
        this.contain.setStyle({'opacity': 0.6}).removeClass('buttonEnabled');
        this.updateState();
    },

    toggleActive: function () {
        (this.isActive) ? this.deactivate() : this.activate();
    },

    hoverOn: function () {
        if (!this.isDisabled) {
            this.isHover = true;
            this.updateState();
            this.ne.fireEvent("buttonOver", this);
        }
    },

    hoverOff: function () {
        this.isHover = false;
        this.updateState();
        this.ne.fireEvent("buttonOut", this);
    },

    mouseClick: function () {
        if (this.options.command) {
            this.ne.nicCommand(this.options.command, this.options.commandArgs);
            if (!this.options.noActive) {
                this.toggleActive();
            }
        }
        this.ne.fireEvent("buttonClick", this);
    },

    key: function (nicInstance, e) {
        if (this.options.key && e.ctrlKey && String.fromCharCode(e.keyCode || e.charCode).toLowerCase() == this.options.key) {
            this.mouseClick();
            if (e.preventDefault) e.preventDefault();
        }
    }

});


var nicPlugin = bkClass.extend({

    construct: function (nicEditor, options) {
        this.options = options;
        this.ne = nicEditor;
        this.ne.addEvent('panel', this.loadPanel.closure(this));

        this.init();
    },

    loadPanel: function (np) {
        var buttons = this.options.buttons;
        var button;	// rmm7752
        for (var button in buttons) {
            np.addButton(button, this.options);
        }
        np.reorder();
    },

    init: function () {
    }
});


/* START CONFIG */
var nicPaneOptions = {};
/* END CONFIG */

var nicEditorPane = bkClass.extend({
    construct: function (elm, nicEditor, options, openButton) {
        this.ne = nicEditor;
        this.elm = elm;
        this.pos = elm.pos();

        this.contain = new bkElement('div').setStyle({
            zIndex: '99999',
            overflow: 'visible',
            position: 'absolute',
            left: this.pos[0] + 'px',
            top: this.pos[1] + 'px'
        }); // rmm7752
        // rmm7752: this.pane = new bkElement('div').setStyle({fontSize : '12px', border : '1px solid #ccc', 'overflow': 'hidden', padding : '4px', textAlign: 'left', backgroundColor : '#ffffc9'}).addClass('pane').setStyle(options).appendTo(this.contain);
        this.pane = new bkElement('div').setStyle({'overflow': 'hidden'}).addClass('pane').setStyle(options).appendTo(this.contain); // rmm7752

        var setWidth;	// rmm7752
        if (openButton && !openButton.options.noClose) {
            this.close = new bkElement('div').setStyle({
                'float': 'right',
                height: '16px',
                width: '16px',
                cursor: 'pointer'
            }).addEvent('mouseup', openButton.removePane.closure(this)).appendTo(this.pane);
            // rmm7752: .setStyle(this.ne.getIcon('close',nicPaneOptions))
            this.close.className = "omnis-wf-close omnis-wf-butt";	// rmm7752
            setWidth = true;	// rmm7752
        }

        this.contain.noSelect().appendTo(document.body);
        this.pane.style.width = "100%";

        this.position();

        if (setWidth) this.contain.style.width = "400px";	// rmm7752
        this.init();
    },

    init: function () {
    },

    position: function () {
        if (this.ne.nicPanel) {
            var panelElm = this.ne.nicPanel.elm;
            var panelPos = panelElm.pos();
            var newLeft = panelPos[0] + parseInt(panelElm.getStyle('width')) - (parseInt(this.pane.getStyle('width')) + 8);
            if (newLeft < this.pos[0]) {
                this.contain.setStyle({left: newLeft + 'px'});
            }
            // Start rmm7752
            var adj = (this.ne.selectedInstance && this.ne.selectedInstance.omnisCtrl) ? this.ne.selectedInstance.omnisCtrl.borderWidth : 0;
            if (adj > 1) {
                adj -= 1;
                this.contain.setStyle({left: (adj + parseInt(this.contain.getStyle('left'))) + 'px'});
                this.contain.setStyle({top: (adj + parseInt(this.contain.getStyle('top'))) + 'px'});
            }
            // End rmm7752
        }
    },

    toggle: function () {
        this.isVisible = !this.isVisible;
        this.contain.setStyle({display: ((this.isVisible) ? 'block' : 'none')});
    },

    remove: function () {
        if (this.contain) {
            this.contain.remove();
            this.contain = null;
        }
    },

    append: function (c) {
        c.appendTo(this.pane);
    },

    setContent: function (c) {
        this.pane.setContent(c);
    }

});


var nicEditorAdvancedButton = nicEditorButton.extend({

    init: function () {
        this.ne.addEvent('selected', this.removePane.closure(this)).addEvent('blur', this.removePane.closure(this));
    },

    mouseClick: function () {
        if (!this.isDisabled) {
            if (this.pane && this.pane.pane) {
                this.removePane();
            }
            else {
                this.pane = new nicEditorPane(this.contain, this.ne, {
                    width: (this.width || '270px'),
                    backgroundColor: '#fff'
                }, this);
                this.addPane();
                this.ne.selectedInstance.saveRng();
            }
        }
    },

    addForm: function (f, elm) {
        this.form = new bkElement('form').addEvent('submit', this.submit.closureListener(this));
        this.inputs = {};

        var firstInput;	// rmm7752
        for (itm in f) {
            var field = f[itm];
            var val = '';
            if (elm) {
                val = elm.getAttribute(itm);
            }
            if (!val) {
                val = field['value'] || '';
            }
            var type = f[itm].type;

            if (type == 'title') {
                // Start rmm7752
                var title = new bkElement('div').setContent(field.txt); // // rmm7752: .setStyle({ fontSize: '14px', fontWeight: 'bold', padding: '0px', margin: '2px 0' });
                this.pane.append(title);
                this.pane.close.remove();
                this.pane.close.appendTo(title);
                title.className = "omnis-wf-title  omnis-wf-radii omnis-wf-title-active omnis-wf-shadow-title";
                title.style.marginBottom = "5px";
                // End rmm7752
            }
            else {
                var contain = new bkElement('div').setStyle({overflow: 'hidden', clear: 'both'}).appendTo(this.form);
                if (field.txt) {
                    new bkElement('label').setAttributes({'for': itm}).setContent(field.txt).setStyle({
                        margin: '2px 4px',
                        fontSize: '13px',
                        width: '50px',
                        lineHeight: '20px',
                        textAlign: 'right',
                        'float': 'left'
                    }).appendTo(contain);
                }

                switch (type) {
                    case 'text':
                        this.inputs[itm] = new bkElement('input').setAttributes({
                            id: itm,
                            'value': val,
                            'type': 'text'
                        }).setStyle({
                            margin: '2px 0',
                            fontSize: '13px',
                            'float': 'left',
                            height: '20px',
                            border: '1px solid #ccc',
                            overflow: 'hidden'
                        }).setStyle(field.style).appendTo(contain);
                        if (firstInput == null) firstInput = this.inputs[itm];	// rmm7752
                        break;
                    case 'select':
                        this.inputs[itm] = new bkElement('select').setAttributes({id: itm}).setStyle({
                            border: '1px solid #ccc',
                            'float': 'left',
                            margin: '2px 0'
                        }).appendTo(contain);
                        for (opt in field.options) {
                            var o = new bkElement('option').setAttributes({
                                value: opt,
                                selected: (opt == val) ? 'selected' : ''
                            }).setContent(field.options[opt]).appendTo(this.inputs[itm]);
                        }
                        break;
                    case 'content':
                        this.inputs[itm] = new bkElement('textarea').setAttributes({id: itm}).setStyle({
                            border: '1px solid #ccc',
                            'float': 'left'
                        }).setStyle(field.style).appendTo(contain);
                        this.inputs[itm].value = val;
                }
            }
        }
        // Start rmm7752
        this.pane.append(this.form);
        this.pane.contain.className = "omnis-wf-shadow omnis-wf-radii omnis-wf omnis-wf-active";
        if (jOmnis.touchDevice) this.pane.contain.ontouchstart = omnisDFMouseDown;
        else this.pane.contain.onmousedown = omnisDFMouseDown;
        // End rmm7752
        var sub = new bkElement('input').setAttributes({'type': 'submit'}).setStyle({
            backgroundColor: '#efefef',
            border: '1px solid #ccc',
            margin: '0 48px 4px 0',
            'float': 'right',
            'clear': 'both'
        }).appendTo(this.form); // rmm7752
        sub.value = jOmnis.okString;	// rmm7752
        this.form.onsubmit = bkLib.cancelEvent;
        if (firstInput) firstInput.focus();	// rmm7752
    },

    submit: function () {
    },

    findElm: function (tag, attr, val) {
        var list = this.ne.selectedInstance.getElm().getElementsByTagName(tag);
        for (var i = 0; i < list.length; i++) {
            if (list[i].getAttribute(attr) == val) {
                return $BK(list[i]);
            }
        }
    },

    removePane: function () {
        if (this.pane) {
            if (this.pane.parentNode && this.pane.parentNode.parentNode) this.pane.parentNode.parentNode.removeChild(this.pane.parentNode);	// rmm7752
            this.pane.remove();
            this.pane = null;
            // rmm7752: this.ne.selectedInstance.restoreRng();
            // Start rmm7752
            var se = this.ne.selectedInstance;
            setTimeout(function () {
                try {
                    se.omnisCtrl.handleEvent({"type": "omnis-setdata"});
                    se.omnisCtrl.focus();
                    se.restoreRng();
                }
                catch (e) {
                }
            }, 0);
            // End rmm7752
        }
    }
});

/* START CONFIG */
var nicSelectOptions = {
    buttons: {
        'fontSize': {name: __('Font Size'), type: 'nicEditorFontSizeSelect', command: 'fontsize'},
        'fontFamily': {name: __('Font Family'), type: 'nicEditorFontFamilySelect', command: 'fontname'}
        // rmm7752: 'fontFormat' : {name : __('Select Font Format'), type : 'nicEditorFontFormatSelect', command : 'formatBlock'}
    }
};
/* END CONFIG */
var nicEditorSelect = bkClass.extend({

    construct: function (e, buttonName, options, nicEditor, omnisCtrl) { // rmm7752
        this.options = options.buttons[buttonName];
        this.elm = e;
        this.ne = nicEditor;
        this.name = buttonName;
        this.omnisCtrl = omnisCtrl;	// rmm7752
        this.selOptions = [];

        this.margin = new bkElement('div').setStyle({'float': 'left', margin: '2px 1px 0 1px'}).appendTo(this.elm);
        this.contain = new bkElement('div').setStyle({
            height: '20px',
            cursor: 'pointer',
            overflow: 'hidden',
            color: 'black'
        }).addClass('selectContain').addEvent('click', this.toggle.closure(this)).appendTo(this.margin); // rmm7752
        this.items = new bkElement('div').setStyle({
            overflow: 'hidden',
            zoom: 1,
            border: '1px solid #ccc',
            paddingLeft: '3px',
            backgroundColor: '#fff'
        }).appendTo(this.contain);
        this.control = new bkElement('div').setStyle({
            overflow: 'hidden',
            'float': 'right',
            height: '18px',
            width: '16px'
        }).addClass('selectControl').setStyle(this.ne.getIcon('arrow', options)).appendTo(this.items);
        this.txt = new bkElement('div').setStyle({
            overflow: 'hidden',
            'float': 'left',
            height: '14px',
            marginTop: '1px',
            fontFamily: 'sans-serif',
            textAlign: 'center',
            fontSize: '12px'
        }).addClass('selectTxt').appendTo(this.items); // rmm7752

        if (!window.opera) {
            this.contain.onmousedown = this.control.onmousedown = this.txt.onmousedown = bkLib.cancelEvent;
        }

        this.margin.noSelect();

        this.ne.addEvent('selected', this.enable.closure(this)).addEvent('blur', this.disable.closure(this));

        this.disable();
        this.init();
    },

    disable: function () {
        this.isDisabled = true;
        this.close();
        this.contain.setStyle({opacity: 0.6});
    },

    enable: function (t) {
        this.isDisabled = false;
        this.close();
        this.contain.setStyle({opacity: 1});
    },

    setDisplay: function (txt) {
        this.txt.setContent(txt);
    },

    toggle: function () {
        if (!this.isDisabled) {
            (this.pane) ? this.close() : this.open();
        }
    },

    open: function () {
        this.pane = new nicEditorPane(this.items, this.ne, {
            padding: '0px',
            borderTop: 0,
            borderLeft: '1px solid #ccc',
            borderRight: '1px solid #ccc',
            borderBottom: '0px',
            backgroundColor: '#fff'
        });

        for (var i = 0; i < this.selOptions.length; i++) {
            var opt = this.selOptions[i];
            var itmContain = new bkElement('div').setStyle({
                overflow: 'hidden',
                borderBottom: '1px solid #ccc',
                textAlign: 'left',
                overflow: 'hidden',
                cursor: 'pointer'
            });
            var itm = new bkElement('div').setStyle({padding: '0px 4px'}).setContent(opt[1]).appendTo(itmContain).noSelect();
            itm.addEvent('click', this.update.closure(this, opt[0])).addEvent('mouseover', this.over.closure(this, itm)).addEvent('mouseout', this.out.closure(this, itm)).setAttributes('id', opt[0]);
            this.pane.append(itmContain);
            if (!window.opera) {
                itm.onmousedown = bkLib.cancelEvent;
            }
        }
    },

    close: function () {
        if (this.pane) {
            this.pane = this.pane.remove();
        }
    },

    over: function (opt) {
        opt.setStyle({backgroundColor: '#ccc'});
    },

    out: function (opt) {
        opt.setStyle({backgroundColor: '#fff'});
    },


    add: function (k, v) {
        this.selOptions.push([k, v]);
    },

    update: function (elm) {
        this.ne.nicCommand(this.options.command, elm);
        this.close();
    }
});

var nicEditorFontSizeSelect = nicEditorSelect.extend({
    sel: {
        1: '1&nbsp;(8pt)',
        2: '2&nbsp;(10pt)',
        3: '3&nbsp;(12pt)',
        4: '4&nbsp;(14pt)',
        5: '5&nbsp;(18pt)',
        6: '6&nbsp;(24pt)'
    },
    init: function () {
        this.setDisplay(this.omnisCtrl.translate("fontsize", "Font&nbsp;Size", true));	// rmm7752
        for (itm in this.sel) {
            // rmm7752: this.add(itm,'<font size="'+itm+'">'+this.sel[itm]+'</font>');
            // Start rmm7752
            var sz = this.sel[itm];
            var op = sz.indexOf('(');
            var cp = sz.indexOf('pt');
            var szVal = sz.substr(op + 1, cp - op + 1);
            this.add(itm, '<span style="font-size:' + szVal + '">' + szVal + '</span>');
            // End rmm7752
        }
    }
});

var nicEditorFontFamilySelect = nicEditorSelect.extend({
    sel: {
        'arial': 'Arial',
        'comic sans ms': 'Comic Sans',
        'courier new': 'Courier New',
        'georgia': 'Georgia',
        'helvetica': 'Helvetica',
        'impact': 'Impact',
        'times new roman': 'Times',
        'trebuchet ms': 'Trebuchet',
        'verdana': 'Verdana'
    },

    init: function () {
        this.setDisplay(this.omnisCtrl.translate("fontfamily", "Font&nbsp;Family", true));	// rmm7752
        for (itm in this.sel) {
            // rmm7752: this.add(itm,'<font face="'+itm+'">'+this.sel[itm]+'</font>');
            this.add(itm, '<span style="font-family:' + itm + '">' + this.sel[itm] + '</span>'); // rmm7752
        }
    }
});

var nicEditorFontFormatSelect = nicEditorSelect.extend({
    sel: {
        'p': 'Paragraph',
        'pre': 'Pre',
        'h6': 'Heading&nbsp;6',
        'h5': 'Heading&nbsp;5',
        'h4': 'Heading&nbsp;4',
        'h3': 'Heading&nbsp;3',
        'h2': 'Heading&nbsp;2',
        'h1': 'Heading&nbsp;1'
    },

    init: function () {
        this.setDisplay('Font&nbsp;Format...');
        for (itm in this.sel) {
            var tag = itm.toUpperCase();
            this.add('<' + tag + '>', '<' + itm + ' style="padding: 0px; margin: 0px;">' + this.sel[itm] + '</' + tag + '>');
        }
    }
});

nicEditors.registerPlugin(nicPlugin, nicSelectOptions);


/* START CONFIG */
var nicColorOptions = {
    buttons: {
        'forecolor': {name: __('Text color'), type: 'nicEditorColorButton', noClose: true},
        'bgcolor': {name: __('Background color'), type: 'nicEditorBgColorButton', noClose: true}
    }
};
/* END CONFIG */

var nicEditorColorButton = nicEditorAdvancedButton.extend({
    addPane: function () {
        var colorList = {0: '00', 1: '33', 2: '66', 3: '99', 4: 'CC', 5: 'FF'};
        var colorItems = new bkElement('DIV').setStyle({width: '270px'});

        for (var r in colorList) {
            for (var b in colorList) {
                for (var g in colorList) {
                    var colorCode = '#' + colorList[r] + colorList[g] + colorList[b];

                    var colorSquare = new bkElement('DIV').setStyle({
                        'cursor': 'pointer',
                        'height': '15px',
                        'float': 'left'
                    }).appendTo(colorItems);
                    var colorBorder = new bkElement('DIV').setStyle({border: '2px solid ' + colorCode}).appendTo(colorSquare);
                    var colorInner = new bkElement('DIV').setStyle({
                        backgroundColor: colorCode,
                        overflow: 'hidden',
                        width: '11px',
                        height: '11px'
                    }).addEvent('click', this.colorSelect.closure(this, colorCode)).addEvent('mouseover', this.on.closure(this, colorBorder)).addEvent('mouseout', this.off.closure(this, colorBorder, colorCode)).appendTo(colorBorder);

                    if (!window.opera) {
                        colorSquare.onmousedown = colorInner.onmousedown = bkLib.cancelEvent;
                    }

                }
            }
        }
        this.pane.append(colorItems.noSelect());
    },

    colorSelect: function (c) {
        this.ne.nicCommand('foreColor', c);
        this.removePane();
    },

    on: function (colorBorder) {
        colorBorder.setStyle({border: '2px solid #000'});
    },

    off: function (colorBorder, colorCode) {
        colorBorder.setStyle({border: '2px solid ' + colorCode});
    }
});

var nicEditorBgColorButton = nicEditorColorButton.extend({
    colorSelect: function (c) {
        this.ne.nicCommand('hiliteColor', c);
        this.removePane();
    }
});

nicEditors.registerPlugin(nicPlugin, nicColorOptions);


/* START CONFIG */
/* rmm7898:
var nicImageOptions = {
	buttons: {
		'image': { name: 'Add image', type: 'nicImageButton', tags: ['IMG'] }
	}

};
*/
/* END CONFIG */
/* rmm7898:
var nicImageButton = nicEditorAdvancedButton.extend({
	addPane: function ()
	{
		// Start rmm7752
		try
{
			this.im = this.ne.selectedInstance.selElm().parentTag('IMG');
		}
		catch (e)
		{
			this.im = null;
		}
		// End rmm7752
		this.addForm({
			// rmm7752:
			'': { type: 'title', txt: this.omnisCtrl.translate("addeditimage", 'Add or edit image') }, // rmm7752
			'src': { type: 'text', txt: '', 'value': 'http://', style: { marginLeft: "50px", width: '300px' } }
			// 'alt' : {type : 'text', txt : 'Alt Text', style : {width: '100px'}},
			// 'align' : {type : 'select', txt : 'Align', options : {none : 'Default','left' : 'Left', 'right' : 'Right'}}
		}, this.im);
	},

	submit: function (e)
	{
		var src = this.inputs['src'].value;
		if (src == "" || src == "http://")
		{
			alert(this.omnisCtrl.translate("imageerror", "You must enter an image URL to insert")); // rmm7752
			return false;
		}
		this.removePane();

		if (!this.im)
		{
			var tmp = 'javascript:nicImTemp();';
			this.ne.nicCommand("insertImage", tmp);
			this.im = this.findElm('IMG', 'src', tmp);
		}
		if (this.im)
		{
			this.im.setAttributes({
				src: this.inputs['src'].value
				// alt : this.inputs['alt'].value,
				// align : this.inputs['align'].value
			});
		}
	}
});

nicEditors.registerPlugin(nicPlugin, nicImageOptions);
*/

// ###################################################################
// ##### file initialization #########################################
// ###################################################################
// put any global code here that must execute after the script above
// has been parsed
var gNicEdit;			// The controlling nicEdit object - all nicEdit controls are managed by this object
var gNicEditCopyRight = "Copyright (c) 2007-2008 Brian Kirchoff (http://nicedit.com). Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.";
