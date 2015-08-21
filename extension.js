define(function(require, exports, module) {
	var ExtensionManager = require('code/extensionManager');
	
	var Code = require('code/code');
	var Socket = require('code/socket');
	var Fn = require('code/fn');
	var Workspace = require('code/workspace');
	var FileManager = require('code/fileManager');
	
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
			EditorSplit.on('open', function(id) {
				Extension.build(id, EditorSplit.getSplit(id).find('.box-container-inner'));
			});
			
			for (var i in EditorSplit.getStorage().splits) {
				Extension.build(i, EditorSplit.getSplit(i).find('.box-container-inner'));
			}
			
			EditorSplit.on('moveSession', function(data) {
				if (data.type == 'image') {
					var box = EditorSplit.getSplit(data.split).find('.image-holder .table-cell');
					_self.getElem(data.id).appendTo(box);
				}
			});
			
			EditorSplit.on('resize', function() {
				$(Editor.elem).find('.image-holder').each(function() {
					var height = $(this).height();
					$(this).find('img').css({maxHeight: height});
				});
			});
			
			$(window).on('resize', function() {
				$(Editor.elem).find('.image-holder').each(function() {
					var height = $(this).height();
					$(this).find('img').css({maxHeight: height});
				});
			});
			
			EditorSession.registerSessionHandler({
				canHandle: function(data) {
					return (data.data.type == 'file' && ['png', 'jpg', 'jpeg', 'gif'].indexOf(Fn.pathinfo(data.data.path).extension) !== -1) || data.data.type == 'image' ? 'image' : false;
				},
				open: Extension.session.open.bind(Extension.session),
				active: Extension.session.active.bind(Extension.session),
				close: Extension.session.close.bind(Extension.session)
			});
		},
		build: function(id, elem) {
			$(elem).append('<div class="holder image-holder"><div class="table"><div class="table-cell"></div></div><div class="image-size"></div></div>');
			
			
			$(elem).find('.image-holder').on('click', function() {
				EditorSplit.active = parseInt(id);
			});
		},
		getElem: function(id) {
			return $(Editor.elem).find('.image-holder img[data-id=' + id + ']');
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
				var sess = data.session;
				
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
				
				this.build(id, storage);
			},
			build: function(id, data) {
				FileManager.getFile(data.workspaceId, data.path, null, function(file, data) {
					var sess = EditorSession.getStorage().sessions[id];
					
					if (sess) {
						var cell = EditorSplit.getSplit(sess.split).find('.image-holder .table-cell');
						
						var img = document.createElement('img');
						img.setAttribute('data-id', id);
						img.src = 'data:' + Extension.getMimeName(data.path) + ';base64,' + btoa(file);
						img.style.display = 'none';
						img.style.maxHeight = $(cell).parent().parent().height() + 'px';
						img.dataset.size = file.length;
						// $(cell).find('img').hide();
						$(cell).append(img);
						
						var sessData = EditorSession.sessions[id];
						sessData.status = 2;
						EditorSession.statusUpdated(id);
						
						if (sess.active) {
							Extension.session.active({id: id, data: sess});
						}
					}
				}, function(data) {
					EditorSession.close(EditorSession.isOpenedByData('image', data.id, data.path));
				});
			},
			active: function(data) {
				var cell = EditorSplit.getSplit(data.data.split).find('.image-holder .table-cell');
				
				$(cell).find('img').hide();
				var $img = $(cell).find('img[data-id="' + data.id + '"]').show();
				
				if ($img.length) {
					$(cell).parent().parent().find('.image-size').html($img[0].naturalWidth + 'x' + $img[0].naturalHeight + ' (' + FileManager.fileSize($img.attr('data-size')) + ')');
				}
				
			},
			close: function(data) {
				var cell = EditorSplit.getSplit(data.data.split).find('.image-holder .table-cell');
				
				$(cell).find('img[data-id="' + data.id + '"]').remove();
			}
		}
	});

	module.exports = Extension;
});