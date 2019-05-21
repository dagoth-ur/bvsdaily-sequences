// vim: foldmethod=marker
//@SequenceName: Daily Intro

//@SequenceCode

//{{{1 Utilities

function dbg(msg) {
    console.log(msg);
}

function DocRegex(re, idx) { "use strict";
    dbg('Regexing: ' + re);
    var result = re.exec(document.body.innerText);
    dbg('Regex result: ' + result);
    if (idx == undefined)
        idx = 0;
    if (result == null) {
        return result;
    } else {
        return result[idx];
    }
}

function DocReInt(re) { "use strict";
    return parseInt(DocRegex(re, 1));
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

//{{{2 Parsers for various pages
function BvSPlayerId() {
    return $('input[name=player]').value;
}

// function parseTeamSelection
//2}}}

//{{{2 DailyStorage
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
function LastBvSDayroll(now) { "use strict";
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

/** 
 * Wraps around DailyStorage. Adds -<playername> to the prefix.
 */
function PlayerStorage(localstorage_prefix, dayroll_vals) {
    return DailyStorage(localstorage_prefix + '-' + BvSPlayerId(),
                        dayroll_vals);
}
//2}}}
//1}}}

//@NewTask
//@TaskName: Awesome cat
GoPage('main');
IncrementTaskIf(!DocTest('Look at this cat.'));
FormSetValue('videochallenge', 'videoroll', 'yes');
FormSubmit('videochallenge');

//@NewTask
//@TaskName: Bonus code
GoPage('main');
IncrementTaskIf(!DocRegex(/Collect your Bonus Stamina/));
$('input[name=bonusget]').scrollIntoView();
ShowMsg('Type ze bonus code.');

//@NewTask
//@TaskName: Breakfast bingo

GoPage('breakfast');

IncrementTaskIf(DocTest('Breakfast Results:'));

FormCheck('dobfast', 'bfconfirm');
FormCheck('dobfast', 'tr-bfast');

FormCheck('dobfast', 'bingo-b1');
FormUncheck('dobfast', 'bingo-b2');
FormCheck('dobfast', 'bingo-b3');
FormUncheck('dobfast', 'bingo-b4');
FormCheck('dobfast', 'bingo-b5');

FormSubmit('dobfast');

//@NewTask
//@TaskName: Shorty

TeamChange('Shorty');

//@NewTask
//@TaskName: Party

GoPage('ph_partyroom');
IncrementTaskIf(!DocTest('Parties today: 0'));
FormCheck('pr', 'partytype', 'Bash');
FormSubmit('pr');

//@NewTask
//@TaskName: Pachinko

// Test if we're at machine.
if (LocationTest('partyhouse-pachinkoplay.html')) {
    // End if used all balls
    IncrementTaskIf(DocTest('Electrum: 0'));
    // Otherwise, keep using
    (function () {
        var regex = /Electrum: (\d+)/;
        var balls = parseInt(regex.exec(document.body.innerHTML)[1]);
        if (FormSetValue('dropball', 'numdrop', Math.min(balls, 1000)))
            FormSubmit('dropball');
    })();
}

// Else navigate to page
GoPage('ph_pachinko');
if (DocTest('You survey the rows of machines, including the ominous one'
           +' in the back')) {
    FormSubmit('startpc');
}
// Buy balls
if (DocTest('Buys today: 0'))
    FormSubmit('buyballs');
// Goto first machine
if (FormCheckById('playapachi', 'pmach1'))
    FormSubmit('playapachi');

//@NewTask
//@TaskName: Tsukiball

GoPage('ph_tsukiball');

if (FormCheck('skic', 'tixtype', 'plastic'))
    FormSubmit('skic');

if (DocTest('You are on Ball')) {
    FormCheck('skib', 'rolltype', 'high');
    FormCheck('skib', 'doemall');
    FormSubmit('skib');
} else if (!DocTest('Final Score:')) {
    FormSelect('skib', 'megatsuki', false, 'Play a MegaGame');
    FormSubmit('skib');
}

IncrementTask();

//@NewTask
//@TaskName: Strawberry Team

TeamChange('Strawberry', 'Shorty', 'Robogirl');

//@NewTask
//@TaskName: Arena stuff

GoPage('arena');

if (DocTest('buy-ins so far today: 0')
        || DocTest('buy-ins so far today: 1'))
    FormSubmit('buyfights');

IncrementTaskIf(!DocTest('Fights today: <b>0</b>'));

FormCheck('arenafight', 'megaarena');
FormSubmit('arenafight');

//@NewTask
//@TaskName: Fight kaiju

GoPage('kaiju');

if (!DocTest("You had this Kaiju's drop"))
    ShowMsg("ZOMG, drop you don't have yet. Do this manually");

var times = DocReInt(/times fought today: (\d+)/);
IncrementTaskIf(times >= 6);

if (times < 4) {
    FormCheck('kat', 'tsukiball');
} else {
    FormUncheck('kat', 'tsukiball');
}
if (!DocTest('Crippled!')) {
    var jutsu = 'Bring Down the House Jutsu';
    var jutsuCost = DocReInt(new RegExp(jutsu + ' \\((\\d+) C\\)'));
    dbg('Cost: ' + jutsuCost);
    var chakra = DocReInt(/Chakra: (\d+)/);
    if (jutsuCost > chakra)
        FormSubmit('chakra');
    FormCheck('kat', 'jutsuused', jutsu);
} else {
    FormCheck('kat', 'jutsuused', 'none');
}
FormSubmit('kat');

//@NewTask
//@TaskName: Switching to solo

GoPage('team');
if (FormTest('conteam'))
    FormSubmit('conteam');
IncrementTaskIf(DocTest('<b>Solo</b> - no Teammates, no Bonus'));
FormSubmit('maketeam');


//@NewTask
//@TaskName: Village actions

GoPage('village');

// Paperwork or collect
if (!(DocTest('You are already helping out your Village today')
        || DocTest('You are helping a Village out today'))) {
    var upkeep = DocReInt(/Current Upkeep: (\d+)%/);
    var paperwork = DocReInt(/Paperwork:\D*(\d+)% Upkeep Tomorrow/);
    dbg('Upkeep detected: ' + upkeep);
    dbg('Paperwork detected: ' + paperwork);
    if (paperwork < upkeep) {
        FormSubmit('paperwork');
    } else {
        if (DocTest('Resupply the Z-Fighters')) {
            FormSubmit('zatrs');
        } else {
            FormSubmit('rescol');
        }
    }
}

// Ingredients, lemonade, rock, library
if (!DocTest('Already Searched Today!')) {
    FormCheck('ingredienthunt', 'ingredientplace', 'forest');
    FormSubmit('ingredienthunt');
}
if (DocTest('Have some tasty Lemonade!')) {
    FormSubmit('lemonaid');
}
if (DocTest('Go to a Black Stones Concert!'))
    FormSubmit('blackstones');
if (DocTest('Study at the Pandora Library!'))
    FormSubmit('pandtime');
if (FormCheck('ramen', 'ramentobuy', 'app'))
    FormSubmit('ramen');

IncrementTask();

//@NewTask
//@TaskName: Credit pull

GoPage('marketplace');
IncrementTaskIf(DocTest('Used Today!'));
ShowMsg('uojezu');

//@NewTask
//@TaskName: PizzaWitch

GoPage('pizzawitch');
if (!DocTest("Work a shift on the other Riders' Rides"))
    FormSubmit('workinback');

var deliveries = DocReInt(/Delivery \((\d+) Remaining\)/);
IncrementTaskIf(deliveries === 0);

var tips_str = DocRegex(/Current Tips: ([0-9,]+)/, 1).replace(',','');
var tips = parseInt(tips_str);
var bribe = DocReInt(/\bBribe[^(]*\(-(\d+) Tips\/Shift/);
var max_bribes = Math.trunc(tips / bribe);
FormCheck('doshift', 'shiftbribe', 1);
FormSetValue('doshift', 'shiftcount', Math.min(deliveries, max_bribes));
FormSubmit('doshift');

//@NewTask
//@TaskName: Tattoo thing
// Grinding for ze trophy

ShowMsg('Fix this tomorrow (or today, I guess)');

//@NewTask
//@TaskName: Field actions

GoPage('fields');

var store = PlayerStorage('daily_fields', { drawn_essence : false
                                          , did_actions   : false });

// We either start on the essence field, in which case we want to draw,
// go to farming field and spend free actions. Or we start on the farming 
// field and we want to spend actions first to avoid double field change.
// Persistent storage is required to do this, I think.

if (DocTest('Use Field Oscillator'))
    FormSubmit('oscillator');
if (DocTest('Enough has collected to fill a single vial'))
    FormSubmit('lifestream');
if (DocTest('No more Essence can be collected today')) {
    store.drawn_essence = true;
    IncrementTaskIf(store.did_actions);
    SetField('Brilliant', 'Delicious', 'Paradise');
}
if ($('form[name=search1]')) {
    if (!DocTest('Free actions:')) {
        store.did_actions = true;
        IncrementTaskIf(store.drawn_essence);
        SetField('Brilliant', 'Delicious', 'Dance Floor');
    }
    var free_acts = DocReInt(/Free actions: (\d+)/);
    if (free_acts >= 10 && DocTest('Turn MegaActions On')
            || free_acts < 10 && DocTest('Turn MegaActions Off')) {
        FormSubmit('megaactionflip');
    } else {
        FormSubmit('search1');
    }
}

//@NewTask
//@TaskName: Nom team

TeamChange('Tsukasa', 'Yuki');

//@NewTask
//@TaskName: Nomming

GoPage('consumables');
ShowMsg('Eat things');

//@NewTask
//@TaskName: Larry und Haro

TeamChange('Larry', 'Haro');

//@NewTask
//@TaskName: Run missions

GoPage('missions');
if (LocationTest('missionstart.html')) {
    if ($('form[name=misforms]'))
        FormSubmit('misforms');
    if (DocTest('MegaMissions (Inactive)'))
        FormSubmit('megamis');
    FormSubmit('misformwasteland');
}

if (LocationTest('mission1.html') && DocTest('Only One S-Rank per day!')) {
    FormSubmit('backmission');
}

ShowMsg('Smash those hotkeys');
