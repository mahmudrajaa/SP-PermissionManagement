var app = app || {};

app.UserEditView = Backbone.View.extend({
    template: _.template($('#user-edit-template').html()),
    tagName: 'div',
    className: 'user-edit',

    events: {
        'keyup .search': 'onUsersKeyUp',
        'click #user-select-btn': 'onUserSelectBtnClick',
        'click .save-permissions-btn': 'onSaveClick',
        'click #clear-console': 'onClearConsoleClick',
        'click .export-permissions': 'onExportBtnClick',
        'click .purge-user-btn': 'onPurgeBtnClick',
        'click .search-clear' : 'onSearchClear'
    },

    initialize: function(options) {
        Backbone.pubSub.on('user:selected-permissions-fetched', this.onSelectedPermissionsFetched, this);
        this.state_map = {
            user_permissions: null,
            pendingSaves: 0,
            pendingRemoves: 0,
            totalUpdates: 0,
            progressUpdateRatio: 0,
            currentProgress: 0,
            failed: {
                add: [],
                remove: [],
                purge: []
            },
            success: {
                add: [],
                remove: [],
                purge: []
            }
        }

    },

    select: function(e) {
        Backbone.pubSub.trigger('user:select', this.model);
    },

    render: function() {
        this.$el.html(this.template(this.model.toJSON()));
        this.$users = this.$('#users');
        this.$user_search_container = this.$('.search-container');
        this.$user_search = this.$('.search');
        this.$user_attributes = this.$('.user-attr');
        this.$name = this.$('#name');
        this.$name_container = this.$('#name-container');
        this.$messages = this.$('.messages');
        this.$notify = this.$('.notify');
        this.$progress_meter = this.$('.meter');
        this.$progressbar = this.$('.progress');
        this.$progress_text = this.$('.current-progress');
        this.$search_clear = this.$('.search-clear');
        this.$search = this.$('.search');
        if (this.model.get('name') == '') {
            this.$name.text('Select a User');
        }

        this.libraryViewUsers = new app.LibraryUserView({
            el: this.$users[0],
            collection: app.UserCollection,
            itemView: app.UserView
        });

        this.libraryViewUsers.render();

        Backbone.pubSub.on('user:select', this.userSelect, this);
        if (this.model.get('id') != '') {
            this.userSelect(this.model, false);
        }
        return this;
    },

    search: function() {
        var val = this.$user_search.val(),
            options,
            searchAllAttributes = false;

        //check for search operand character '~'
        if (val.indexOf('~') == 0) {
            //set val to exclude '~'
            val = val.substring(1);
            searchAllAttributes = true;
        }

        options = (searchAllAttributes ? {
            val: val
        } : {
            key: 'name',
            val: val
        });

        if(val.length > 0 ){
             this.$search_clear.removeClass('hidden');
        } else {
            this.$search_clear.addClass('hidden');
        }

        Backbone.pubSub.trigger('library_users:search', options);
    },
    onUserSelectBtnClick: function(e) {

        (function(that) {
            setTimeout(function() {
                that.$user_search.focus();
            }, 0);
        })(this);
    },
    onSearchClear: function(e){
        this.$search.val('');
        this.$search.trigger('keyup');
        e.stopPropagation();
         this.$user_search.focus();
    },
    onUsersKeyUp: function(e) {
        this.search();
    },
    onSelectedPermissionsFetched: function(selected_permissions) {
        var user_permissions = new Backbone.Collection(this.model.get('permissions')),
            user_permission_index,
            add_permissions_arr = [],
            remove_permissions_arr = [],
            user = this.model.attributes;



        //iterate through selected permissions
        selected_permissions.forEach(function(permission) {
            //check if permissions is in user permissions
            //user_permission_index = user_permissions_arr.indexOf(permission);
            user_permission = user_permissions.findWhere({
                name: permission
            });
            if (typeof user_permission !== 'undefined') {
                //remove permission from user permissions
                user_permissions.remove(user_permission);

            } else {
                //add permission to add permission array
                add_permissions_arr.push(permission);
            }
        });
        this.state_map.user_permissions = user_permissions;
        //set remove permissions to the remaining user permissions...for contextual reasons
        remove_permissions_arr = user_permissions.map(function(obj) {
                return obj.get('name');
            }),

            //set state map variables
            this.state_map.pendingSaves = add_permissions_arr.length;
        this.state_map.pendingRemoves = remove_permissions_arr.length;
        this.state_map.totalUpdates = this.state_map.pendingRemoves + this.state_map.pendingSaves;
        this.state_map.progressUpdateRatio = 100 / this.state_map.totalUpdates;
        if (add_permissions_arr.length == 0 && remove_permissions_arr.length == 0) {
            return;
        }

        this.$messages.append('<span class="console-date">' + app.utility.getDateTime() + '</span><div>Modifying [' + user.name + ']\'s permissions</div>');
        //add user permissions
        if (add_permissions_arr.length > 0) {
            (function(that) {
                app.data.modifyPermissions(add_permissions_arr, 0, user, app.config.url, 'add', function(results) {
                    that.processPermissionModify(results);
                });
            })(this);
        }
        //remove user permissions
        if (remove_permissions_arr.length > 0) {
            (function(that) {
                app.data.modifyPermissions(remove_permissions_arr, 0, user, app.config.url, 'remove', function(results) {
                    that.processPermissionModify(results);
                });
            })(this);
        }
    },

    onSaveClick: function(e) {
        this.resetStateMap();
        //update progress bar
        this.$progress_meter.width('0%');
        this.$progress_text.text('0%');
        //publish user selected event
        Backbone.pubSub.trigger('user:save-permissions');
    },

    onClearConsoleClick: function(e) {
        this.clearConsole();
    },

    onExportBtnClick: function(e) {
        var permissions = this.model.get('permissions'),
        ua = window.navigator.userAgent,
         msie = ua.indexOf("MSIE "),
         permissionsElement;

    if (msie > 0) {     // If Internet Explorer, return version number
        permissionsElement = '<h1>' + this.model.get('name') + '\'s Permissions</h1></ul>';
        permissionsElement += permissions.reduce(function(memo, obj){
            return (typeof memo == "string" ? memo :  '<li>' + memo.name + '</li>') + '<li>' + obj.name + '</li>';
        });
        permissionsElement += '</ul>';
        app.utility.printToNewWindow(permissionsElement);
    } else {
        app.utility.JSONToCSVConvertor(permissions, this.model.get('name') + ' Permissions', true);
     }
        
    },

    onPurgeBtnClick: function(e) {
        var user = this.model.attributes;

        this.$messages.append('<span class="console-date">' + app.utility.getDateTime() + '</span><div>Purging [' + user.name + ']</div>');        
        this.$messages.scrollTop(this.$messages[0].scrollHeight);
        (function(that){
             app.data.removeUserFromWeb(app.config.url, user, function(results){
                that.onRemoveUserComplete(results);
             });
        })(this);
       
    },

    onRemoveUserComplete: function(results) {
        var type = results.type,
            data = results.data,
            name = this.model.get('name'),
            message = '';

        if (type != 'error') {
            message = 'Succesfully removed ' + name + ' from site.';
        } else {
            message = 'Unsuccessfully removed ' + name + ' from site.';
        }

        this.$messages.append('<span class="console-date">' + app.utility.getDateTime() + '</span><div>' + message + ' </div>');
    },

    clearConsole: function() {
        this.$messages.html('');
    },

    processPermissionModify: function(results) {
        var operation = results.operation,
            type = results.type,
            data = results.data,
            permission = results.permission,
            message = '',
            class_map = {
                'success': 'success',
                'error': 'error'
            };

        if (type == 'success') {
            this.state_map.success[operation].push(permission);
            message = '['+ permission + '] succesfully ' + (operation == 'add' ? 'added.' : 'removed.');
        } else { //error
            this.state_map.failed[operation].push(permission);
            message = 'Unable to ' + operation + ' [' + permission + '].'
        }
        this.updateProgress(operation);
        this.$messages.append('<span class="console-date">' + app.utility.getDateTime() + '</span><div class="' + (class_map[type] ? class_map[type] : class_map.error) + '">' + message + '</div>');
        this.$messages.scrollTop(this.$messages[0].scrollHeight);
        if (this.state_map.pendingSaves == 0 && this.state_map.pendingRemoves == 0) {
            this.permissionModifyComplete();
        }
    },
    permissionModifyComplete: function() {
        var user = this.model;
        this.$messages.append('<span class="console-date">' + app.utility.getDateTime() + '</span><div>Completed modifying [' + user.get('name') + ']\'s permissions</div>');
        this.$messages.scrollTop(this.$messages[0].scrollHeight);

        this.userSelect(user, true);
    },
    updateProgress: function(operation) {
        this.state_map.currentProgress += this.state_map.progressUpdateRatio;
        //clip progress if needed
        this.state_map.currentProgress = (this.state_map.currentProgress >= 100 ? 100 : this.state_map.currentProgress);
        this.state_map.pendingRemoves -= (operation == 'remove' ? 1 : 0);
        this.state_map.pendingSaves -= (operation == 'add' ? 1 : 0);

        //update progress bar
        this.$progress_meter.width(this.state_map.currentProgress + '%');
        this.$progress_text.text(this.state_map.currentProgress + '%');
    },
    resetStateMap: function() {
        this.state_map.pendingRemoves = 0;
        this.state_map.pendingSaves = 0;
        this.state_map.pendingSaves = 0;
        this.state_map.pendingRemoves = 0;
        this.state_map.totalUpdates = 0;
        this.state_map.progressUpdateRatio = 0;
        this.state_map.failed.add = [];
        this.state_map.failed.remove = [];
        this.state_map.failed.purge = [];
        this.state_map.success.add = [];
        this.state_map.success.remove = [];
        this.state_map.success.purge = [];
    },
    userSelect: function(user, options) {

        if (!user.hasOwnProperty('attributes')) {
            return;
        }
        this.model = user;
        this.$user_attributes.each(function(i, el) {
            $(el).val(user.attributes[el.id]);
        });


        if (!user.attributes.hasOwnProperty('loginname')) {
            return false;
        }


        //fetch user permissions
        this.getUserPermissions(user.attributes.loginname);

        //update message
        this.$messages.append('<span class="console-date">' + app.utility.getDateTime() + '</span><div>Fetching [' + this.model.get('name') + ']\'s permissions</div>');
        this.$messages.scrollTop(this.$messages[0].scrollHeight);
        //update progress bar
        this.$progress_meter.width('0%');
        this.$progress_text.text('0%');
        //publish user selected event
        //set router
        if (options && options.route) {
            app.router.navigate('edit/user/' + user.attributes.loginname.replace('/', '\\'), false);
            Backbone.pubSub.trigger('user:selected');
        } else {
            app.router.navigate('edit/user/' + user.attributes.loginname.replace('/', '\\'), false);
             Backbone.pubSub.trigger('user:selected');
        }

    },
    getUserPermissions: function(loginname) {
        (function(that) {
            app.data.getPermissions(app.config.url, loginname, function(results) {
                //format results
                results = app.utility.processData(results);
                //set selected user model permissions
                that.model.set({
                    permissions: results
                });
                //publish results globally 
                Backbone.pubSub.trigger('user:permissions-fetched', results);
                that.$messages.append('<span class="console-date">' + app.utility.getDateTime() + '</span><div>Completed fetching [' + that.model.get('name') + ']\'s permissions</div>');
                that.$messages.scrollTop(that.$messages[0].scrollHeight);
                that.$progress_meter.width('100%');
                that.$progress_text.text('100%');
            });
        })(this);
    },
    toggleUserDropdown: function() {
        if (this.$name_container.is(':visible')) {
            this.$name_container.hide();
            this.$user_search_container.show();
            this.$users.show();
            this.$user_search.focus();
            this.$users.height(function(index, height) {
                return (window.innerHeight - $(this).offset().top) * 0.9;
            });

            this.$users.width(function(index, height) {
                return (window.innerWidth - $(this).offset().left) * 0.9;
            });
        } else {
            this.$name_container.show();
            this.$user_search_container.hide();
            this.$users.hide();
        }
    }
});
