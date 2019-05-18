//@SequenceName: Daily Intro

//@SequenceCode

var dseq = (function () {
    var dseq = {};

    function dbg(msg) {
        console.log(msg);
    }
    dseq.dbg = dbg;

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
    dseq.DocRegex = DocRegex;

    function DocReInt(re) { "use strict";
        return parseInt(DocRegex(re, 1));
    }
    dseq.DocReInt = DocReInt;

    function KaijuAttack() {
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
    }
    dseq.KaijuAttack = KaijuAttack;

    function TeamSolo() {
        GoPage('team');
        if (FormTest('conteam'))
            FormSubmit('conteam');
        IncrementTaskIf(DocTest('<b>Solo</b> - no Teammates, no Bonus'));
        FormSubmit('maketeam');
    }
    dseq.TeamSolo = TeamSolo;

    function VillageAction() {
        if (DocTest('You are already helping out your Village today')
                || DocTest('You are helping a Village out today'))
            return;
        var upkeep = DocReInt(/Current Upkeep: (\d+)%/);
        var paperwork = DocReInt(/Paperwork:\D*(\d+)% Upkeep Tomorrow/);
        dbg('Upkeep detected: ' + upkeep);
        dbg('Paperwork detected: ' + paperwork);
        if (paperwork < upkeep) {
            FormSubmit('paperwork');
        } else {
            ShowMsg('Finish VillageAction()');
        }
    }
    dseq.VillageAction = VillageAction;

    return dseq;
})();

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

dseq.KaijuAttack();

//@NewTask
//@TaskName: Switching to solo

dseq.TeamSolo();

//@NewTask
//@TaskName: Village actions

GoPage('village');

dseq.VillageAction();
if (!DocTest('Already Searched Today!')) {
    ShowMsg('Fix ingredient search to use positive condition');
    FormCheck('ingredienthunt', 'ingredientplace', 'forest');
    FormSubmit('ingredienthunt');
}
if (!DocTest('already had some Lemonade today')) {
    ShowMsg('Fix lemonade thing!');
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
//@TaskName: Field actions

ShowMsg('Do them manually for now, because that requires statefulness');

//@NewTask
//@TaskName: Nomming

ShowMsg('TODO: finish this');
