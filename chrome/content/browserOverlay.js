var CutCopyPasteTabs = {
    LINE_SEPARATOR: this.Services.appinfo.OS === "WINNT" ? "\r\n" : "\n",
    ON_DEMAND_PREF: "browser.sessionstore.restore_on_demand",
    /**
     * Copies URLs to clipboard and removes the tabs.
     * @see TabContextMenu http://mxr.mozilla.org/mozilla-release/source/browser/base/content/browser.js#6982
     * @see gBrowser http://mxr.mozilla.org/mozilla-release/source/browser/base/content/tabbrowser.xml
     */
    onCut: function () {
        this.onCopy();

        var tabs = this._getTabs();
        for (var i = 0; i < tabs.length; i++) {
            gBrowser.removeTab(tabs[i], {animate: true});
        }
        this._saveState();
    },
    /**
     * Copies URLs to clipboard.
     */
    onCopy: function () {
        var tabs = this._getTabs();
        var uris = Array.map(tabs, function(tab) gBrowser.getBrowserForTab(tab).currentURI.spec);
        var str = uris.join(this.LINE_SEPARATOR);
        var transferable = this._getTransferable(TabContextMenu.contextTab);

        transferable.addDataFlavor("text/unicode");
        transferable.setTransferData("text/unicode", this._getSupportsString(str), str.length * 2);
        this.Services.clipboard.setData(transferable, null, this.Services.clipboard.kGlobalClipboard);
    },
    /**
     * Tries to read the clipboard, extract all well formatted URLs and open them in new tabs
     * behind the tab on which context menu was opened.
     */
    onPaste: function () {
        var uri = {};
        var uriLength = {};
        var transferable = this._getTransferable();

        transferable.addDataFlavor("text/unicode");
        this.Services.clipboard.getData(transferable, this.Services.clipboard.kGlobalClipboard);
        try {
            transferable.getTransferData("text/unicode", uri, uriLength);
        } catch(error) {
            this.Services.console.logStringMessage("[Cut, copy and paste Tabs] " +
                error.name + ": " + error.message);
            this.Services.console.logStringMessage("[Cut, copy and paste Tabs] " +
                "Probably there isn't any text in your clipboard.");
            return;
        }

        uri = uri.value.QueryInterface(Ci.nsISupportsString).toString();

        /**
         * Quite strict regex for matching URLs based on RFC 3986. It allows all the characters, 
         * including ,;' etc. Whitespaces and double quotes " will be the most common delimiters.
         * Matches: scheme://userinfo@host:port/path?query#fragment
         * @see http://tools.ietf.org/html/rfc3986
         */
        var on_demand = false;
        if (this.Services.prefs.getPrefType(this.ON_DEMAND_PREF)) // if exists...
            on_demand = this.Services.prefs.getBoolPref(this.ON_DEMAND_PREF);

        var urlRegex = /\w[\w\d\+\-\.]+:\/\/(?:[\w\d\-\._~%!\$&'\(\)\*\+,;=:]*@)?(?:\[[\d\.A-Fa-f:]+\]|[\w\d\-\._~%!\$&'\(\)\*\+,;=]+)(?::\d+)?(?:\/[\w\d\-\._~%!\$&'\(\)\*\+,;=:@]*)*(?:\?[\w\d\-\._~%!\$&'\(\)\*\+,;=:@\/\?]*)?(?:#[\w\d\-\._~%!\$&'\(\)\*\+,;=:@\/\?]*)?/g;
        var matches = uri.match(urlRegex);
        if (matches) {
            for (var i = 0; i < matches.length; i++) {
                var url = matches[i];
                var tab = null;
                if (on_demand) {
                    // Create new tab, but dont load the content.
                    tab = gBrowser.addTab(null);
                    this.Services.sessionstore.setTabState(tab,
                        '{\
                            "entries":[\
                                {\
                                    "url":"' + url + '",\
                                    "title":"' + url + '"\
                                }\
                            ],\
                            "lastAccessed":0,\
                            "index":1,\
                            "hidden":false,\
                            "attributes":{},\
                            "image":null\
                        }'
                    );
                } else {
                    tab = gBrowser.addTab(url);
                }
                gBrowser.moveTabTo(tab, TabContextMenu.contextTab._tPos+1+i);
            }
            this._saveState();
        }
    },
    /**
     * Highlights and dehighlights context menu items to indicate the operation/command
     * will run on multiple tabs.
     */
    handleEvent: function (event) {
        if (event.target.id == "tabContextMenu") {
            switch (event.type) {
                case 'popupshowing':
                    if (this._getTabs().length > 1) {
                        var menuitems = this._getMenuitems();
                        for (var i = 0; i < menuitems.length; i++) {
                            menuitems[i].setAttribute("style", "font-weight: bold;");
                        }
                    }
                    break;
                case 'popuphiding':
                    var menuitems = this._getMenuitems();
                    for (var i = 0; i < menuitems.length; i++) {
                        menuitems[i].setAttribute("style", "font-weight: normal;");
                    }
                    break;
            }
        }
    },
    /**
     * Returns array of tabs that should be processed.
     * @see https://bugzilla.mozilla.org/show_bug.cgi?id=566510
     * @see https://addons.mozilla.org/addon/bug-566510/
     */
    _getTabs: function () {
        var tabs = TabContextMenu.contextTab.multiselected ? gBrowser.selectedTabs : [TabContextMenu.contextTab];
        return tabs;
    },
    /**
     * Returns array of menuitems that belongs to this addon.
     */
    _getMenuitems: function () {
        var ccptabsItems = [];
        var menuitems = document.getElementById("tabContextMenu").childNodes;
        for (var i = 0; i < menuitems.length; i++) {
            var item = menuitems[i];
            if (/^ccptabs_menu_/.test(item.id))
                ccptabsItems.push(item);
        }
        return ccptabsItems;
    },
    /**
     * @see https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsISupportsString
     */
    _getSupportsString: function (string) {
        var supportsString = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
        supportsString.data = string;
        return supportsString;
    },
    /**
     * @see http://mxr.mozilla.org/mozilla-release/source/widget/nsITransferable.idl#85
     */
    _getTransferable: function (sourceTab) {
        var transferable = Cc["@mozilla.org/widget/transferable;1"].createInstance(Ci.nsITransferable);
        if ("init" in transferable) {
            if (sourceTab) {
                var window = gBrowser.getBrowserForTab(sourceTab).contentDocument.defaultView;
                var loadContext = window.QueryInterface(Ci.nsIInterfaceRequestor)
                    .getInterface(Ci.nsIWebNavigation)
                    .QueryInterface(Ci.nsILoadContext);
                transferable.init(loadContext);
            } else {
                transferable.init(null);
            }
        }
        return transferable;
    },
    /**
     * Force Firefox to save the browser session.
     * @see http://mxr.mozilla.org/mozilla-central/source/browser/components/sessionstore/src/SessionSaver.jsm#74
     */
    _saveState: function () {
        try {
            Components.utils.import("resource:///modules/sessionstore/SessionSaver.jsm", this);
            this.SessionSaver.run();
        } catch (e) {
            // SessionSaver is available since Firefox 26.
        }
    },
    Services: {}
}

/**
 * Load services
 */
XPCOMUtils.defineLazyServiceGetter(CutCopyPasteTabs.Services, "appinfo",
    "@mozilla.org/xre/app-info;1",
    "nsIXULRuntime");
XPCOMUtils.defineLazyServiceGetter(CutCopyPasteTabs.Services, "clipboard",
    "@mozilla.org/widget/clipboard;1",
    "nsIClipboard");
XPCOMUtils.defineLazyServiceGetter(CutCopyPasteTabs.Services, "console",
    "@mozilla.org/consoleservice;1",
    "nsIConsoleService");
XPCOMUtils.defineLazyServiceGetter(CutCopyPasteTabs.Services, "prefs",
    "@mozilla.org/preferences-service;1",
    "nsIPrefBranch");
XPCOMUtils.defineLazyServiceGetter(CutCopyPasteTabs.Services, "sessionstore",
    "@mozilla.org/browser/sessionstore;1",
    "nsISessionStore");
