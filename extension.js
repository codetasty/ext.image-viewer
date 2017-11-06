/* global define, $, config */
"use strict";

define(function(require, exports, module) {
	const ExtensionManager = require('core/extensionManager');
	
	const Socket = require('core/socket');
	const Fn = require('core/fn');
	const Workspace = require('core/workspace');
	const Crypto = require('core/crypto');
	const FileManager = require('core/fileManager');
	
	const Editor = require('modules/editor/editor');
	const EditorSession = require('modules/editor/ext/session');
	const EditorSplit = require('modules/editor/ext/split');
	
	class Extension extends ExtensionManager.Extension {
		constructor() {
			super({
				name: 'image-viewer',
				css: [
					'extension',
				]
			});
			
			this.onSplitOpen = this.onSplitOpen.bind(this);
			this.onMoveSession = this.onMoveSession.bind(this);
			
			this.sessionOpen = this.sessionOpen.bind(this);
			this.sessionActive = this.sessionActive.bind(this);
			this.sessionFocus = this.sessionFocus.bind(this);
			this.sessionClose = this.sessionClose.bind(this);
		}
		
		init() {
			super.init();
			var _self = this;
			
			EditorSplit.splitCall((split) => {
				if (split.supports('image')) {
					this.build(split);
				}
			});
			
			EditorSplit.on('open', this.onSplitOpen);
			EditorSplit.on('moveSession', this.onMoveSession);
			
			EditorSession.registerSessionHandler({
				name: this.name,
				canHandle: function(data) {
					return data.type == 'image' || (data.type == 'file' && ['png', 'jpg', 'jpeg', 'gif'].indexOf(Fn.pathinfo(data.path).extension) !== -1) ? 'image' : false;
				},
				open: this.sessionOpen,
				active: this.sessionActive,
				focus: this.sessionFocus,
				close: this.sessionClose,
			});
		}
		
		destroy(e) {
			super.destroy();
			
			EditorSplit.off('open', this.onSplitOpen);
			EditorSplit.off('moveSession', this.onMoveSession);
			
			EditorSession.removeSessionHandler(this.name);
			
			for (var i in EditorSession.getStorage().sessions) {
				if (EditorSession.getStorage().sessions[i].type === 'image') {
					EditorSession.close(i);
				}
			}
		}
		
		onSplitOpen(split) {
			this.build(split);
		}
		
		onMoveSession(session, split) {
			if (session.storage.type === 'image') {
				session.$image.appendTo(split.$el.find('.image-holder'));
			}
		}
		
		build(split) {
			split.$el.find('.box-container').append('<div class="holder image-holder"></div>');
		}
		
		getMimeName(path) {
			var res = 'image/png';
			switch (Fn.pathinfo(path).extension) {
				case 'png':
					res = 'image/png';
					break;
					
				case 'jpg':
				case 'jpeg':
					res = 'image/jpeg';
					break;
					
				case 'gif':
					res = 'image/gif';
					break;
			}
			
			return res;
		}
		
		sessionOpen(session) {
			var opened = session.opened;
			
			if (!opened) {
				Object.assign(session.storage, {
					name: Fn.pathinfo(session.storage.path).basename,
					icon: 'design_image',
					type: 'image',
					extension: Fn.pathinfo(session.storage.path).extension
				});
				EditorSession.storage.save();
			}
			
			session.size = null;
			session.mimeType = null;
			session.width = null;
			session.height = null;
			
			this.sessionBuild(session);
		}
		
		sessionBuild(session) {
			var id = session.id;
			
			session.$image = $('<div class="image" data-id="' + session.id + '"></div>')
			.hide().click(() => {
				EditorSession.setFocus(session.id);
			});
			
			EditorSplit.get(session.storage.split).$el
			.find('.image-holder').append(session.$image);
			
			session.status = EditorSession.status.downloading;
			session.indicatorStatus = EditorSession.indicatorStatus.downloading;
			
			FileManager.get(session.storage.workspaceId, session.storage.path, {
				buffer: true,
			}).then(res => {
				if (!EditorSession.exists(session)) {
					return;
				}
				
				var img = document.createElement('img');
				img.onload = () => {
					session.width = img.naturalWidth;
					session.height = img.naturalHeight;
					
					if (session.isFocus) {
						EditorSession.checkFocus(session);
					}
				};
				img.src = 'data:' + this.getMimeName(session.storage.path) + ';base64,' + res.data.toString('base64');
				img.dataset.size = res.data.length;
				
				session.size = res.data.length;
				session.mimeType = this.getMimeName(session.storage.path);
				session.width = img.naturalWidth;
				session.height = img.naturalHeight;
				
				session.$image.append(img);
				
				session.status = EditorSession.status.ready;
				session.indicatorStatus = EditorSession.indicatorStatus.default;
				
				if (session.focus) {
					EditorSession.checkFocus(session);
				}
			}).catch(e => {
				EditorSession.close(session.id);
			});
		}
		
		sessionActive(session) {
			session.$image.parent().children().hide();
			session.$image.show();
		}
		
		sessionFocus(session, $toolbar) {
			var $workspace = $('<li class="sticky"></li>').text(Workspace.get(session.storage.workspaceId).name);
			
			var $path = $('<li class="sticky"></li>');
			$path.text(session.storage.isNew ? 'New file' : session.storage.name);
			
			$toolbar.children('.toolbar-left').append($workspace);
			$toolbar.children('.toolbar-left').append($path);
			
			if (session.size === null) {
				return;
			}
			
			var $res = $('<li></li>');
			$res.text(session.width + 'x' + session.height + 'px');
			
			var $size = $('<li></li>');
			$size.text(FileManager.size(session.size));
			
			var $mime = $('<li></li>');
			$mime.text(session.mimeType);
			
			$toolbar.children('.toolbar-right').append($res);
			$toolbar.children('.toolbar-right').append($size);
			$toolbar.children('.toolbar-right').append($mime);
		}
		
		sessionClose(session) {
			if (session.$image) {
				session.$image.remove();
			}
		}
	}

	module.exports = new Extension();
});