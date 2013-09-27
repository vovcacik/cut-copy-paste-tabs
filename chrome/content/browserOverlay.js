const LINE_SEPARATOR = Services.appinfo.OS === "WINNT" ? "\r\n" : "\n";

var CutCopyPasteTabs = {
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
    },
    /**
     * Copies URLs to clipboard.
     */
    onCopy: function () {
        var tabs = this._getTabs();
        var uris = Array.map(tabs, function(tab) gBrowser.getBrowserForTab(tab).currentURI.spec);
        var str = uris.join(LINE_SEPARATOR);
        var transferable = this._getTransferable(TabContextMenu.contextTab);

        transferable.addDataFlavor("text/unicode");
        transferable.setTransferData("text/unicode", this._getSupportsString(str), str.length * 2);
        Services.clipboard.setData(transferable, null, Services.clipboard.kGlobalClipboard);
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
        Services.clipboard.getData(transferable, Services.clipboard.kGlobalClipboard);
        try {
            transferable.getTransferData("text/unicode", uri, uriLength);
        } catch(error) {
            Services.console.logStringMessage("[Cut, copy and paste Tabs] " +
                error.name + ": " + error.message);
            Services.console.logStringMessage("[Cut, copy and paste Tabs] " +
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
        var urlRegex = /\w[\w\d\+\-\.]+:\/\/(?:[\w\d\-\._~%!\$&'\(\)\*\+,;=:]*@)?(?:\[[\d\.A-Fa-f:]+\]|[\w\d\-\._~%!\$&'\(\)\*\+,;=]+)(?::\d+)?(?:\/[\w\d\-\._~%!\$&'\(\)\*\+,;=:@]*)*(?:\?[\w\d\-\._~%!\$&'\(\)\*\+,;=:@\/\?]*)?(?:#[\w\d\-\._~%!\$&'\(\)\*\+,;=:@\/\?]*)?/g;
        var matches = uri.match(urlRegex);
        if (matches) {
            for (var i = 0; i < matches.length; i++) {
                var tab = gBrowser.addTab(matches[i]);
                gBrowser.moveTabTo(tab, TabContextMenu.contextTab._tPos+1+i);
            }
        }
    },
    /**
     * Highlights and dehighlights context menu items to indicate the operation/command
     * will run on multiple tabs.
     */
    handleEvent: function (event) {
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
        if (sourceTab) {
            var window = gBrowser.getBrowserForTab(sourceTab).contentDocument.defaultView;
            var loadContext = window.QueryInterface(Ci.nsIInterfaceRequestor)
                .getInterface(Ci.nsIWebNavigation)
                .QueryInterface(Ci.nsILoadContext);
            transferable.init(loadContext);
        } else {
            transferable.init(null);
        }
        return transferable;
    }
}

/**
 * Listen to opening and hiding of tab context menu to make our menu items bold
 * if there are multiselected tabs.
 */
window.addEventListener(
    "load",
    function(event) {
        var tabContextMenu = document.getElementById("tabContextMenu");
        tabContextMenu.addEventListener("popupshowing", CutCopyPasteTabs, false);
        tabContextMenu.addEventListener("popuphiding", CutCopyPasteTabs, false);
    },
    false
);
