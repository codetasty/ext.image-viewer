define(function(require, exports, module) {
	'use strict';
	
	var ExtensionManager = require('core/extensionManager');
	
	var Socket = require('core/socket');
	var Fn = require('core/fn');
	var Workspace = require('core/workspace');
	var Crypto = require('core/crypto');
	var FileManager = require('core/fileManager');
	
	var Editor = require('modules/editor/editor');
	var EditorSession = require('modules/editor/ext/session');
	var EditorSplit = require('modules/editor/ext/split');
	
	var Extension = ExtensionManager.register({
		name: 'image-viewer',
		css: [
			'extension'
		]
	}, {
		init: function() {
			var _self = this;
			
			EditorSplit.splitCall(function() {
				if (this.supports('image')) {
					Extension.build(this);
				}
			});
			
			EditorSplit.on('open', this.onSplitOpen);
			
			EditorSplit.on('moveSession', this.onMoveSession);
			
			EditorSession.registerSessionHandler({
				name: this.name,
				canHandle: function(data) {
					return data.type == 'image' || (data.type == 'file' && ['png', 'jpg', 'jpeg', 'gif'].indexOf(Fn.pathinfo(data.path).extension) !== -1) ? 'image' : false;
				},
				open: Extension.session.open.bind(Extension.session),
				active: Extension.session.active.bind(Extension.session),
				focus: Extension.session.focus.bind(Extension.session),
				close: Extension.session.close.bind(Extension.session)
			});
		},
		destroy: function(e) {
			EditorSplit.off('open', this.onSplitOpen);
			EditorSplit.off('moveSession', this.onMoveSession);
			
			EditorSession.removeSessionHandler(this.name);
			
			for (var i in EditorSession.getStorage().sessions) {
				if (EditorSession.getStorage().sessions[i].type === 'image') {
					EditorSession.close(i);
				}
			}
		},
		onSplitOpen: function(split) {
			Extension.build(split);
		},
		onMoveSession: function(session, split) {
			if (session.storage.type === 'image') {
				// var box = EditorSplit.getSplit(e.split).find('.image-holder');
				// Extension.getElem(e.sessionId).appendTo(box);
				session.$image.appendTo(split.$el.find('.image-holder'));
			}
		},
		build: function(split) {
			split.$el.find('.box-container-inner').append('<div class="holder image-holder"></div>');
		},
		getMimeName: function(path) {
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
		},
		session: {
			open: function(session) {
				var opened = session.opened;
				
				if (!opened) {
					session.storage = $.extend(true, session.storage, {
						name: Fn.pathinfo(session.storage.path).basename,
						icon: 'design_image',
						type: 'image',
						extension: Fn.pathinfo(session.storage.path).extension
					});
					EditorSession.saveStorage();
				}
				
				session.size = null;
				session.mimeType = null;
				session.width = null;
				session.height = null;
				
				this.build(session);
			},
			build: function(session) {
				var id = session.id;
				
				session.$image = $('<div class="image" data-id="' + session.id + '"></div>')
				.hide().click(function() {
					EditorSession.setFocus(session.id);
				});
				
				EditorSplit.get(session.storage.split).$el
				.find('.image-holder').append(session.$image);
				
				session.status = EditorSession.status.DOWNLOADING;
				session.indicatorStatus = EditorSession.indicatorStatus.DOWNLOADING;
				
				FileManager.get({
					id: session.storage.workspaceId,
					path: session.storage.path,
					buffer: true,
					file: function(file) {
						if (!session.storage) {
							return;
						}
						
						if (!file) {
							EditorSession.close(session.id);
							
							return false;
						}
						
						var img = document.createElement('img');
						img.onload = function() {
							session.width = img.naturalWidth;
							session.height = img.naturalHeight;
							
							if (session.focus) {
								EditorSession.checkFocus(session);
							}
						};
						img.src = 'data:' + Extension.getMimeName(session.storage.path) + ';base64,' + file.toString('base64');
						img.dataset.size = file.length;
						
						session.size = file.length;
						session.mimeType = Extension.getMimeName(session.storage.path);
						session.width = img.naturalWidth;
						session.height = img.naturalHeight;
						
						session.$image.append(img);
						
						session.status = EditorSession.status.READY;
						session.indicatorStatus = EditorSession.indicatorStatus.DEFAULT;
						
						if (session.focus) {
							EditorSession.checkFocus(session);
						}
					}
				});
			},
			active: function(session) {
				session.$image.parent().children().hide();
				session.$image.show();
			},
			focus: function(session, $toolbar) {
				var $workspace = $('<li class="sticky"></li>').text(Workspace.get(session.storage.workspaceId).name);
				
				var $path = $('<li class="sticky"></li>');
				$path.text(session.storage.isNew ? __('New file') : session.storage.name);
				
				$toolbar.children('.toolbar-left').append($workspace);
				$toolbar.children('.toolbar-left').append($path);
				
				if (session.size === null) {
					return;
				}
				
				var $res = $('<li></li>');
				$res.text(session.width + 'x' + session.height + 'px');
				
				var $size = $('<li></li>');
				$size.text(FileManager.fileSize(session.size));
				
				var $mime = $('<li></li>');
				$mime.text(session.mimeType);
				
				$toolbar.children('.toolbar-right').append($res);
				$toolbar.children('.toolbar-right').append($size);
				$toolbar.children('.toolbar-right').append($mime);
			},
			close: function(session) {
				if (session.$image) {
					session.$image.remove();
				}
			}
		}
	});

	module.exports = Extension;
});