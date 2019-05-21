// vim: foldmethod=marker
function dbg(msg) {
    console.log(msg);
}

function DocRegex(re, idx) { "use strict";
    dbg('Regexing: ' + re);
    var result = re.exec(document.body.innerText);
    dbg('Regex result: ' + result);
    if (idx == undefined || typeof idx != 'number' || result == null) {
        return result;
    } else {
        return result[idx];
    }
}

function DocReInt(re) { "use strict";
    return parseInt(DocRegex(re, 1));
}

function arrEq(arr1, arr2) { "use strict";
    if (arr1 === arr2)
        return true;
    if (arr1.length !== arr2.length)
        return false;
    for (let i = 0; i < arr1.length; ++i) {
        if (arr1[i] !== arr2[i])
            return false;
    }
    return true;
}

//{{{ XPath and QuerySelector helpers
function $x(xpath, context) { "use strict";
    if (context == undefined)
        context = document;
    var result = document.evaluate(xpath, context, null, 
                                   XPathResult.ANY_UNORDERED_NODE_TYPE, null);
    return result.singleNodeValue;
}

function $$x(xpath, context) { "use strict";
    if (context == undefined)
        context = document;
    var result = document.evaluate(xpath, context, null,
                                   XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
                                   null);
    var retarr = [];
    var res;
    while ((res = result.iterateNext()))
        retarr.push(res);
    return retarr;
}

function $(selector, context) { "use strict";
    if (context == undefined)
        context = document;
    return context.querySelector(selector);
}

function $$(selector, context) { "use strict";
    if (context == undefined)
        context = document;
    return Array.from(context.querySelectorAll(selector));
}
//}}}

//{{{ Page parsers
function parseTeamPage() { "use strict";
    var curteam_node = $x(
        '//b[text()="-Current Team-"]/following-sibling::center');
    var curteam = [];
    if (curteam_node) {
        curteam = $$x('.//td/b', curteam_node).map((node) => node.innerText);
        curteam.sort();
    }
    return { curteam };
}
//}}}

//{{{ Extra actions
function FormUncheck(strFormName, strInputName, strInputValue) {
    var strXPath = "";
 
    // Form name is optional, include it if necessary
    if (strFormName)
        strXPath += '//form[@name=\'' + strFormName + '\']';
 
    // Input name is mandatory (else we cannot find the input box...)
    strXPath += '//input[@name=\'' + strInputName + '\'';
 
    // Input value is also optional
    if (strInputValue)
        strXPath += ' and @value=\'' + strInputValue + '\'';
    strXPath += ']';
 
    var elem = document.evaluate(strXPath, document, null, 
                                 XPathResult.ANY_UNORDERED_NODE_TYPE, null)
        .singleNodeValue;
 
    // Return without action if element does not exist or is disabled
    if (!elem || elem.disabled)
        return false;
 
    // Otherwise check the box and return true
    elem.checked = false;
    return true;
}
 
function FormCheckById(strFormName, strInputId, checked) {
    if (checked == undefined)
        checked = true;
    var strXPath = "";
 
    // Form name is optional, include it if necessary
    if (strFormName)
        strXPath += '//form[@name=\'' + strFormName + '\']';
 
    // Input name is mandatory (else we cannot find the input box...)
    strXPath += '//input[@id=\'' + strInputId + '\']';
 
    var elem = document.evaluate(strXPath, document, null, 
                                 XPathResult.ANY_UNORDERED_NODE_TYPE, null)
        .singleNodeValue;
 
    // Return without action if element does not exist or is disabled
    if (!elem || elem.disabled)
        return false;
 
    // Otherwise check the box and return true
    elem.checked = checked;
    return true;
}
//}}}

/**
 * Returns time & date of dayroll preceding the given timestamp.
 * Argument defaults to current time.
 *
 * Is kind of horrible.
 *
 * Whether it works is probably implementation dependent.
 * In particular, it's implementation dependent what locales and what timezones
 * will be recognized, so the values used here might or might not work.
 *
 * The witchcraft involved will be off by an hour on the days of DST switch in
 * American central timezone, in the dark hours between the moment of the
 * switch and dayroll. This shouldn't make a difference when comparing current
 * time with previous dayroll time. Hopefully.
 */
function LastBvSDayroll(now) { "use strict;";
    const dayroll_time = 5 * 60 * 60 + 15 * 60; // Seconds since midnight
    if (now == undefined)
        now = new Date();
    var tz_opt = { timeZone : 'America/Chicago' };
    var time_str = now.toLocaleTimeString('pl', tz_opt);
    if (!/^\d{2}:\d{2}:\d{2}$/.test(time_str)) {
        throw new Error(
            'LastBvSDayroll: time not in hh:mm:ss format for some reason' +
            ` (time_str: ${time_str})`);
    }
    var [hour, min, sec] = time_str.split(':').map((s) => parseInt(s, 10));
    var time_offs = hour * 60 * 60 + min * 60 + sec;
    var dayroll_offs = time_offs - dayroll_time;
    if (dayroll_offs < 0)
        dayroll_offs += 24 * 60 * 60;
    return new Date(now.getTime() - 1000 * dayroll_offs);
}

/** 
 * Creates a proxy object that forwards property access to local storage.
 * First argument is the prefix used for storage keys.
 * Second argument is the Object of keys/values that should be set at dayroll.
 * Properties are stored as <localstorage_prefix>.<property_name>
 * __last_dayroll__ property is reserved
 */
function DailyStorage(localstorage_prefix, dayroll_vals) { "use strict";
    var last_store_dayroll_str = 
            localStorage.getItem(`${localstorage_prefix}.__last_dayroll__`);
    var last_store_dayroll = new Date(parseInt(last_store_dayroll_str || 0));
    var last_dayroll = LastBvSDayroll();
    if (last_dayroll> last_store_dayroll) {
        for (let p in dayroll_vals) {
            if (!dayroll_vals.hasOwnProperty(p))
                continue;
            localStorage.setItem(`${localstorage_prefix}.${p}`,
                                 JSON.stringify(dayroll_vals[p]));
        }
        localStorage.setItem(`${localstorage_prefix}.__last_dayroll__`,
                             last_dayroll.getTime());
    }

    function check_prop(prop) {
        if (prop === '__last_dayroll__')
            throw new Error(
                'DailyStorage: __last_dayroll__ property is reserved');
    }

    var handler = {
        set(target, prop, newval) {
            check_prop(prop);
            localStorage.setItem(`${localstorage_prefix}.${prop}`, 
                                 JSON.stringify(newval));
        },
        get(target, prop) {
            return JSON.parse(
                localStorage.getItem(`${localstorage_prefix}.${prop}`));
        },
        deleteProperty(target, prop) {
            check_prop(prop);
            localStorage.removeItem(`${localstorage_prefix}.${prop}`);
        }
    };
    return new Proxy({}, handler);
}
