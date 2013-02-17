/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Based on Y.Calendar by lijing00333@163.com (jayli)

YUI.add('postmile-calendar', function (Y) {
    /**
    * @class Y.Calendar
    * @param { string } hook or trigger
    * @param { object } option
    * @return { object } a new calendar
    * @requires { 'node' }
    * @requires { calendar-skin-default } skin
    * 
    * Y.Calenar	
    *	info	calendar constructor
    *	useage	new Y.Calendar(id,options);
    *	param	id:{string} container id
    *	confgi	selected {date} selected date
    *			date:{date} default date
    *		   startDay:{number} start weekday offset,0 by default
    *		Y.Calendar 's method
    *			init
    *			render,rewrite old params
    *			hide
    *			show
    *		
    */
    YUI.namespace('Y.Calendar');

    var monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    if (typeof Y.Node.prototype.queryAll == 'undefined') {
        Y.Node.prototype.queryAll = Y.Node.prototype.all;
        Y.Node.prototype.query = Y.Node.prototype.one;
        Y.Node.get = Y.Node.one;
        Y.get = Y.one;
    }
    Y.Calendar = function () {
        this.init.apply(this, arguments);
    };
    Y.mix(Y.Calendar, {
        init: function (id, config) {
            var that = this;
            that.id = that.C_Id = id;
            that.buildParam(config);
            var trigger = Y.one('#' + id);
            that.trigger = trigger;
            that.C_Id = 'C_' + Math.random().toString().replace(/.\./i, '');
            that.con = Y.Node.create('<div id="' + that.C_Id + '"></div>');
            Y.one('body').appendChild(that.con);
            that.con.setStyle('top', '0px');
            that.con.setStyle('position', 'absolute');
            that.con.setStyle('zIndex', '1000');
            that.con.setStyle('visibility', 'hidden');
            that.buildEventCenter();
            that.render();
            that.buildEvent();
            return this;
        },

        buildEventCenter: function () {
            var that = this;
            var EventFactory = function () {
                this.publish("select");
                this.publish("switch");
                this.publish("selectcomplete");
                this.publish("hide"); //later
                this.publish("show"); //later
            };
            Y.augment(EventFactory, Y.Event.Target);
            that.EventCenter = new EventFactory();
            return this;
        },

        on: function (type, foo) {
            var that = this;
            that.EventCenter.subscribe(type, foo);
            return this;
        },
        render: function (o) {
            var that = this;
            var o = o || {};
            that.parseParam(o);
            that.ca = [];

            that.con.set('innerHTML', '');
            that.ca.push(new that.Call({
                year: that.year,
                month: that.month,
                prev_arrow: true,
                next_arrow: true
            }, that));

            that.ca[0].render();
            return this;
        },

        showdate: function (n, d) {
            var uom = new Date(d - 0 + n * 86400000);
            uom = uom.getFullYear() + "/" + (uom.getMonth() + 1) + "/" + uom.getDate();
            return new Date(uom);
        },

        buildEvent: function () {
            var that = this;
            //flush event
            for (var i = 0; i < that.EV.length; i++) {
                if (typeof that.EV[i] != 'undefined') {
                    that.EV[i].detach();
                }
            }
            that.EV[0] = Y.Node.get('document').on('click', function (e) {
                if (e.target.get('id') == that.C_Id) return;
                var f = e.target.ancestor(function (node) {
                    if (node.get('id') == that.C_Id) return true;
                    else return false;
                });
                if (typeof f == 'undefined' || f == null) {
                    that.hide();
                }
            });

            that.EV[1] = Y.one('#' + that.id).on('click', function (e) {
                e.halt();
                if (e.type == 'click') {
                    that.toggle();
                }
            });

            return this;
        },
        toggle: function () {
            var that = this;
            if (that.con.getStyle('visibility') == 'hidden') {
                that.show();
            } else {
                that.hide();
            }
        },

        inArray: function (v, a) {
            var o = false;
            for (var i = 0, m = a.length; i < m; i++) {
                if (a[i] == v) {
                    o = true;
                    break;
                }
            }
            return o;
        },

        show: function () {
            var that = this;
            that.con.setStyle('visibility', '');
            var _x = that.trigger.getXY()[0];
            var _y = that.trigger.getXY()[1] + that.trigger.get('region').height;
            that.con.setStyle('left', _x.toString() + 'px');
            that.con.setStyle('top', _y.toString() + 'px');
            return this;
        },
        hide: function () {
            var that = this;
            that.con.setStyle('visibility', 'hidden');
            return this;
        },
        handleOffset: function () {
            var that = this,
			data = ['Sun', 'Mon', 'Tue', 'Wen', 'Thu', 'Fri', 'Sat'],
			temp = '<span>{$day}</span>',
			offset = that.startDay,
			day_html = '',
			a = [];
            for (var i = 0; i < 7; i++) {
                a[i] = {
                    day: data[(i - offset + 7) % 7]
                };
            }
            day_html = that.templetShow(temp, a);

            return {
                day_html: day_html
            };
        },
        buildParam: function (o) {
            var that = this;
            if (typeof o == 'undefined' || o == null) {
                var o = {};
            }
            that.date = (typeof o.date == 'undefined' || o.date == null) ? new Date() : o.date;
            that.selected = (typeof o.selected == 'undefined' || o.selected == null) ? that.date : o.selected;
            that.startDay = (typeof o.startday == 'undefined' || o.startDay == null) ? 0 : o.startDay;
            if (o.startDay) {
                that.startDay = (7 - o.startDay) % 7;
            }
            that.EV = [];
            return this;
        },

        parseParam: function (o) {
            var that = this;
            if (typeof o == 'undefined' || o == null) {
                var o = {};
            }
            for (var i in o) {
                that[i] = o[i];
            }
            that.handleDate();
            return this;
        },
        getNumOfDays: function (year, month) {
            return 32 - new Date(year, month - 1, 32).getDate();
        },

        templetShow: function (templet, data) {
            var that = this;
            if (data instanceof Array) {
                var str_in = '';
                for (var i = 0; i < data.length; i++) {
                    str_in += that.templetShow(templet, data[i]);
                }
                templet = str_in;
            } else {
                var value_s = templet.match(/{\$(.*?)}/g);
                if (data !== undefined && value_s != null) {
                    for (var i = 0, m = value_s.length; i < m; i++) {
                        var par = value_s[i].replace(/({\$)|}/g, '');
                        value = (data[par] !== undefined) ? data[par] : '';
                        templet = templet.replace(value_s[i], value);
                    }
                }
            }
            return templet;
        },
        handleDate: function () {
            var that = this;
            var date = that.date;
            that.weekday = date.getDay() + 1;
            that.day = date.getDate();
            that.month = date.getMonth();
            that.year = date.getFullYear();
            return this;
        },
        monthAdd: function () {
            var that = this;
            if (that.month == 11) {
                that.year++;
                that.month = 0;
            } else {
                that.month++;
            }
            that.date = new Date(that.year.toString() + '/' + (that.month + 1).toString() + '/1');
            return this;
        },
        monthMinus: function () {
            var that = this;
            if (that.month == 0) {
                that.year--;
                that.month = 11;
            } else {
                that.month--;
            }
            that.date = new Date(that.year.toString() + '/' + (that.month + 1).toString() + '/1');
            return this;
        },
        computeNextMonth: function (a) {
            var that = this;
            var _year = a[0];
            var _month = a[1];
            if (_month == 11) {
                _year++;
                _month = 0;
            } else {
                _month++;
            }
            return [_year, _month];
        },
        //constructor
        /**
        * @constructor Y.Calendar.prototype.Call
        * @param {object} config,
        * @param {object} fathor,
        * @return
        */
        Call: function (config, fathor) {
            this.fathor = fathor;
            this.month = Number(config.month);
            this.year = Number(config.year);
            this.prev_arrow = config.prev_arrow;
            this.next_arrow = config.next_arrow;
            this.node = null;
            this.timmer = null;
            this.id = '';
            this.EV = [];
            this.html = [
			'<div class="calendar" id="{$id}">',
				'<div class="header">',
					'<a class="prev {$prev}">&lt;&lt;</a>',
					'<div class="title">{$title}</div>',
					'<a class="next {$next}">&gt;&gt;</a>',
				'</div>',
				'<div class="days">',
					'<div class="weekdays">',
						fathor.handleOffset().day_html,
					'</div>',
					'<div class="row clearfix">',
						'{$ds}',
					'</div>',
				'</div>',
			'</div>'
		].join("");

            this.Verify = function () {

                var isDay = function (n) {
                    if (!/^\d+$/i.test(n)) return false;
                    n = Number(n);
                    return !(n < 1 || n > 31);

                },
				isYear = function (n) {
				    if (!/^\d+$/i.test(n)) return false;
				    n = Number(n);
				    return !(n < 100 || n > 10000);

				},
				isMonth = function (n) {
				    if (!/^\d+$/i.test(n)) return false;
				    n = Number(n);
				    return !(n < 1 || n > 12);


				};

                return {
                    isDay: isDay,
                    isYear: isYear,
                    isMonth: isMonth

                };

            };

            this.renderUI = function () {
                var cc = this;
                cc.HTML = '';
                var _o = {};
                _o.prev = '';
                _o.next = '';
                _o.title = '';
                _o.ds = '';
                if (!cc.prev_arrow) {
                    _o.prev = 'hidden';
                }
                if (!cc.next_arrow) {
                    _o.next = 'hidden';
                }
                _o.id = cc.id = 'cc-' + Math.random().toString().replace(/.\./i, '');
                _o.title = monthNames[cc.month] + ' ' + cc.year;
                cc.createDS();
                _o.ds = cc.ds;
                cc.fathor.con.appendChild(Y.Node.create(cc.fathor.templetShow(cc.html, _o)));
                cc.node = Y.one('#' + cc.id);
                return this;
            };

            this.buildEvent = function () {
                var cc = this;
                var con = Y.one('#' + cc.id);
                //flush event
                for (var i = 0; i < cc.EV.length; i++) {
                    if (typeof cc.EV[i] != 'undefined') {
                        cc.EV[i].detach();
                    }
                }
                cc.EV[0] = con.query('div.row').on('click', function (e) {
                    e.halt();
                    if (e.target.hasClass('hide')) return;
                    var selectedd = Number(e.target.get('innerHTML'));
                    var d = new Date(cc.year + '/' + Number(cc.month + 1) + '/' + selectedd);
                    cc.fathor.dt_date = d;
                    cc.fathor.EventCenter.fire('select', d);
                    cc.fathor.hide();
                    cc.fathor.render({ selected: d });
                });
                cc.EV[1] = con.query('a.prev').on('click', function (e) {
                    e.halt();
                    cc.fathor.monthMinus().render();
                    cc.fathor.EventCenter.fire('switch', new Date(cc.fathor.year + '/' + (cc.fathor.month + 1) + '/01'));
                });
                cc.EV[2] = con.query('a.next').on('click', function (e) {
                    e.halt();
                    cc.fathor.monthAdd().render();
                    cc.fathor.EventCenter.fire('switch', new Date(cc.fathor.year + '/' + (cc.fathor.month + 1) + '/01'));
                });
                return this;

            };
            this.getNode = function () {
                var cc = this;
                return cc.node;
            };
            this.createDS = function () {
                var cc = this;
                var s = '';
                var startweekday = (new Date(cc.year + '/' + (cc.month + 1) + '/01').getDay() + cc.fathor.startDay + 7) % 7;
                var k = cc.fathor.getNumOfDays(cc.year, cc.month + 1) + startweekday;

                for (var i = 0; i < k; i++) {
                    //prepare data {{
                    if (/532/.test(Y.UA.webkit)) {//hack for chrome
                        var _td_s = new Date(cc.year + '/' + Number(cc.month + 1) + '/' + (i + 1 - startweekday).toString());
                    } else {
                        var _td_s = new Date(cc.year + '/' + Number(cc.month + 1) + '/' + (i + 2 - startweekday).toString());
                    }
                    var _td_e = new Date(cc.year + '/' + Number(cc.month + 1) + '/' + (i + 1 - startweekday).toString());
                    //prepare data }}
                    if (i < startweekday) {//null
                        s += '<a class="hide">0</a>';
                    } else if (i == (startweekday + (new Date()).getDate() - 1)
							&& (new Date()).getFullYear() == cc.year
							&& (new Date()).getMonth() == cc.month
							&& i == (startweekday + cc.fathor.selected.getDate() - 1)
							&& cc.month == cc.fathor.selected.getMonth()
							&& cc.year == cc.fathor.selected.getFullYear()) {//selected+today
                        s += '<a class="selected today">' + (i - startweekday + 1) + '</a>';

                    } else if (i == (startweekday + (new Date()).getDate() - 1)
							&& (new Date()).getFullYear() == cc.year
							&& (new Date()).getMonth() == cc.month) {//today
                        s += '<a class="today">' + (i - startweekday + 1) + '</a>';

                    } else if (i == (startweekday + cc.fathor.selected.getDate() - 1)
							&& cc.month == cc.fathor.selected.getMonth()
							&& cc.year == cc.fathor.selected.getFullYear()) {//selected
                        s += '<a class="selected">' + (i - startweekday + 1) + '</a>';
                    } else {//other
                        s += '<a>' + (i - startweekday + 1) + '</a>';
                    }
                }
                if (k % 7 != 0) {
                    for (var i = 0; i < (7 - k % 7); i++) {
                        s += '<a class="hide">0</a>';
                    }
                }
                cc.ds = s;
                return this;
            };

            this.render = function () {
                var cc = this;
                cc.renderUI();
                cc.buildEvent();
                return this;
            };
        }

    }, 0, null, 4);

}, '@VERSION@', { requires: ['node'] });
