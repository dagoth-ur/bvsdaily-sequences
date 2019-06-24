//@SequenceName: Monobuying

function $(selector, context=document) {
    return context.querySelector(selector);
}

function BvSPlayerId() {
    return $('input[name=player]').value;
}

function dbg(...msg) {
    //console.log(...msg);
}

//@SequenceCode
//{{{ DailyStorage
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
function LastBvSDayroll(now) {
    const dayroll_time = 5 * 60 * 60 + 15 * 60; // Seconds since midnight
    if (now == undefined)
        now = new Date();
    var tz_opt = { timeZone : 'America/Chicago' };
    var time_str = now.toLocaleTimeString('pl', tz_opt);
    if (!/^\d{2}:\d{2}:\d{2}$/.test(time_str)) {
        throw new Error(
            'LastBvSDayroll: time not in hh:mm:ss format for some reason'
           +` (time_str: ${time_str})`);
    }
    var [hour, min, sec] = time_str.split(':').map((s) => parseInt(s, 10));
    var time_offs = hour * 60 * 60 + min * 60 + sec;
    var dayroll_offs = time_offs - dayroll_time;
    if (dayroll_offs < 0)
        dayroll_offs += 24 * 60 * 60;
    var ret_secs = Math.floor(now.getTime() / 1000) - dayroll_offs;
    return new Date(ret_secs * 1000);
}

/** 
 * Creates a proxy object that forwards property access to local storage.
 * First argument is the prefix used for storage keys.
 * Second argument is the Object of keys/values that should be set at dayroll.
 * Properties are stored as <localstorage_prefix>.<property_name>
 * __last_dayroll__ property is reserved
 */
function DailyStorage(localstorage_prefix, dayroll_vals) {
    var last_store_dayroll_str = 
            localStorage.getItem(`${localstorage_prefix}.__last_dayroll__`);
    var last_store_dayroll = new Date(parseInt(last_store_dayroll_str || 0));
    dbg(`Last stored dayroll for ${localstorage_prefix}:`
       +` ${last_store_dayroll_str}`);
    var last_dayroll = LastBvSDayroll();
    dbg(`Last calculated dayroll: ${last_dayroll.getTime()}`);
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
            dbg(`Setting ${localstorage_prefix}.${prop} to ${newval}`);
            localStorage.setItem(`${localstorage_prefix}.${prop}`, 
                                 JSON.stringify(newval));
        },
        get(target, prop) {
            var ret = JSON.parse(
                localStorage.getItem(`${localstorage_prefix}.${prop}`));
            dbg(`Getting ${ret} from ${localstorage_prefix}.${prop}`);
            return ret;
        },
        deleteProperty(target, prop) {
            check_prop(prop);
            localStorage.removeItem(`${localstorage_prefix}.${prop}`);
        }
    };
    return new Proxy({}, handler);
}

/** 
 * Wraps around DailyStorage. Adds -<playername> to the prefix.
 */
function PlayerStorage(localstorage_prefix, dayroll_vals) {
    return DailyStorage(localstorage_prefix + '-' + BvSPlayerId(),
                        dayroll_vals);
}
//}}}

//@NewTask
//@TaskName: Reset storage
var store = PlayerStorage('buymono');
store.have = 0;
ShowMsg('Monochrome Pheromone inv set to 0');

//@NewTask
//@TaskName: Inc inventory
var store = PlayerStorage('buymono');
store.have += 1;
ShowMsg(`Monochrome Pheromone inv set to ${store.have}`);

//@NewTask
//@TaskName: Check inv
var store = PlayerStorage('buymono');
ShowMsg(`Monochrome Pheromone inv: ${store.have}`);

//@NewTask
//@TaskName: Do it
GoPage('arena');
var store = PlayerStorage('buymono');
IncrementTaskIf(store.have >= 50);
store.have += 1;
FormCheck('buyreward', 'arenatobuy', 23);
FormSubmit('buyreward');
