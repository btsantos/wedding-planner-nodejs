var guest_index = {};
ko.bindingHandlers.flash = {
    init: function(element) {
        $(element).hide();
    },
    update: function(element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        if (value) {
            $(element).stop().hide().text(value).fadeIn(function() {
                clearTimeout($(element).data("timeout"));
                $(element).data("timeout", setTimeout(function() {
                    $(element).fadeOut();
                    valueAccessor()(null);
                }, 3000));
            });
        }
    },
    timeout: null
};

var Table = function(id, guests) {
    this.guests = ko.observableArray(guests);
    this.guests.id = id;
    this.countGuestsAtTable = ko.computed(function () {
        var count = 0;
        for (var i = 0; i < this.guests().length; i++) {
            count++;
            if (this.guests()[i].hasGuest()) {
                count++;
            }
        }
        return count;
    }, this);
};

var SeatingChartModel = function(tables) {
    var self = this;
    this.tables = ko.observableArray(tables);
    this.availableGuests = ko.observableArray();
    this.availableGuests.id = "Available Guests";
    this.lastAction = ko.observable();
    this.lastError = ko.observable();
    this.maximumGuests = 10;
    this.isTableFull = function(parent) {
        var count = 0;
        for (var i = 0; i < parent().length; i++) {
            count++;
            if (parent()[i].hasGuest()) {
                count++;
            }
        }
        return count < self.maximumGuests;
    };

    this.updateLastAction = function(arg) {
        self.lastAction("Moved " + arg.item.name() + " from " + arg.sourceParent.id + " (seat " + (arg.sourceIndex + 1) + ") to " + arg.targetParent.id + " (seat " + (arg.targetIndex + 1) + ")");
        socket.emit('addGuestToTable', arg.item.id, arg.targetParent.id);
        socket.emit('removeGuestFromTable', arg.item.id, arg.sourceParent.id);
    };

    //verify that if a fourth member is added, there is at least one member of each gender
    this.verifyAssignments = function(arg) {
        var found,
            parent = arg.targetParent;

        if (parent.id !== "Available Guests" && parent().length === (this.maximumGuests-1) && parent.indexOf(arg.item) < 0) {
            arg.cancelDrop = true;
        }
    };
};

var initialTables = [];
for (var i = 0; i < 20; i++) {
    var table = new Table(i, []);
    initialTables.push(table);
}

var vm = new SeatingChartModel(initialTables);

ko.bindingHandlers.sortable.beforeMove = vm.verifyAssignments;
ko.bindingHandlers.sortable.afterMove = vm.updateLastAction;

ko.applyBindings(vm,document.getElementById('seating'));

$(document).on( 'loaded' , function (e) {
    socket.on('guestRemovedFromTable', guestRemovedFromTable);
    socket.on('guestAddedToTable', guestAddedToTable);
    loadTables();
});

function guestRemovedFromTable(guest_id, table_id) {
    console.log("Removing "+guest_id+" from table "+table_id);
    if (table_id === "Available Guests") {
        vm.availableGuests.remove(guest_index[guest_id]);
    }
    else if (vm.tables()[table_id].guests.indexOf(guest_index[guest_id]) !== -1) {
        vm.tables()[table_id].guests.remove(guest_index[guest_id]);
    }
};

function guestAddedToTable (guest_id, table_id) {
    console.log("Adding "+guest_id+" to table "+table_id);
    if (table_id === "Available Guests") {
        vm.availableGuests.push(guest_index[guest_id]);
    }
    else if (vm.tables()[table_id].guests.indexOf(guest_index[guest_id]) === -1) {
        vm.tables()[table_id].guests.push(guest_index[guest_id]);
    }
};

function loadTables() {
    vm.availableGuests.removeAll();
    for (var i = 0; i < vm.tables().length; i++) {
        vm.tables()[i].guests.removeAll();
    }
    socket.emit('getGuests', function (guests) {
        for (var i = 0; i < guests.length; i++) {
            var g = guests[i];
            var guest = new Guest(g.id,g.name,g.hasGuest,g.rsvp,g.address,g.table,g.guestName);
            guest_index[g.id] = guest;
            if (typeof g.table === 'undefined' || g.table === -1 || g.table === "-1" || g.table === "Available Guests") {
                vm.availableGuests.push(guest);
            } else {
                vm.tables()[g.table].guests.push(guest);
            }
        }
    });
};
