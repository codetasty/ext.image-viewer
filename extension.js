define(function(require, exports, module) {
	var ExtensionManager = require('core/extensionManager');
	
	var Socket = require('core/socket');
	var Fn = require('core/fn');
	var Workspace = require('core/workspace');
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
			EditorSplit.on('open', this.onSplitOpen);
			
			for (var i in EditorSplit.getStorage().splits) {
				Extension.build(i, EditorSplit.getSplit(i).find('.box-container-inner'));
			}
			
			EditorSplit.on('moveSession', this.onMoveSession);
			
			EditorSession.registerSessionHandler({
				name: this.name,
				canHandle: function(data) {
					return (data.data.type == 'file' && ['png', 'jpg', 'jpeg', 'gif'].indexOf(Fn.pathinfo(data.data.path).extension) !== -1) || data.data.type == 'image' ? 'image' : false;
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
				if (EditorSession.getStorage().sessions[i].type == 'image') {
					EditorSession.close(i);
				}
			}
		},
		onSplitOpen: function(id) {
			Extension.build(id, EditorSplit.getSplit(id).find('.box-container-inner'));
		},
		onMoveSession: function(e) {
			if (e.storage.type == 'image') {
				var box = EditorSplit.getSplit(e.split).find('.image-holder');
				Extension.getElem(e.sessionId).appendTo(box);
			}
		},
		build: function(id, elem) {
			$(elem).append('<div class="holder image-holder"></div>');
		},
		getElem: function(id) {
			return Editor.$el.find('.image-holder .image[data-id=' + id + ']');
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
			open: function(data) {
				var id = data.id;
				var opened = data.opened;
				var storage = data.data;
				var session = data.session;
				
				if (!opened) {
					storage = $.extend(true, storage, {
						name: Fn.pathinfo(storage.path).basename,
						icon: 'design_image',
						type: 'image',
						extension: Fn.pathinfo(storage.path).extension
					});
					EditorSession.saveStorage();
				} else {
					path = storage.path;
				}
				
				session.size = null;
				session.mimeType = null;
				session.width = null;
				session.height = null;
				
				this.build(id, storage);
			},
			build: function(id, data) {
				var $holder = EditorSplit.getSplit(data.split).find('.image-holder');
				var $img = $('<div class="image" data-id="' + id + '"></div>')
				.hide().click(function() {
					EditorSession.setFocus(id);
				});
				
				$holder.append($img);
				
				FileManager.getFile(data.workspaceId, data.path, null, function(file, data) {
					var storage = EditorSession.getStorage().sessions[id];
					
					if (!storage) {
						return false;
					}
					
					var img = document.createElement('img');
					img.src = 'data:' + Extension.getMimeName(data.path) + ';base64,' + btoa(file);
					img.dataset.size = file.length;
					$img.append(img);
					
					var session = EditorSession.sessions[id];
					session.size = file.length;
					session.mimeType = Extension.getMimeName(data.path);
					session.width = img.naturalWidth;
					session.height = img.naturalHeight;
					
					EditorSession.updateStatus(id, 2);
					
					if (session.focus) {
						EditorSession.onFocusChange(true);
					}
				}, function(data) {
					EditorSession.close(EditorSession.isOpenedByData('image', data.id, data.path));
				});
			},
			active: function(data) {
				var $holder = EditorSplit.getSplit(data.data.split).find('.image-holder');
				
				$holder.find('.image').hide().filter('[data-id="' + data.id + '"]').show();
			},
			focus: function(data, $toolbar) {
				var $workspace = $('<li class="sticky"></li>').text(Workspace.getFromList(data.storage.workspaceId).name);
				
				var $path = $('<li class="sticky"></li>');
				$path.text(data.storage.isNew ? __('New file') : data.storage.name);
				
				$toolbar.children('.toolbar-left').append($workspace);
				$toolbar.children('.toolbar-left').append($path);
				
				if (data.session.size === null) {
					return;
				}
				
				var $res = $('<li></li>');
				$res.text(data.session.width + 'x' + data.session.height + 'px');
				
				var $size = $('<li></li>');
				$size.text(FileManager.fileSize(data.session.size));
				
				var $mime = $('<li></li>');
				$mime.text(data.session.mimeType);
				
				$toolbar.children('.toolbar-right').append($res);
				$toolbar.children('.toolbar-right').append($size);
				$toolbar.children('.toolbar-right').append($mime);
			},
			close: function(data) {
				var $holder = EditorSplit.getSplit(data.data.split).find('.image-holder');
				
				$holder.find('.image[data-id="' + data.id + '"]').remove();
			}
		}
	});

	module.exports = Extension;
});