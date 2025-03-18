var markers = [];   // 用于存储标记点的数组
// 创建地图实例
var map = new AMap.Map('container', {
    zoom: 13, // 地图缩放级别
    center: [121.6126, 38.9122] // 大连市区中心经纬度
});

/* 实现可标记功能 */
var markers = [];   // 用于存储标记点的数组

// 监听地图点击事件
map.on('click', function (e) {
    // 创建标记点
    var marker = new AMap.Marker({
        position: [e.lnglat.getLng(), e.lnglat.getLat()],
        map: map
    });
    markers.push(marker);

    // 弹出输入框让用户输入看房信息
    var info = prompt('请输入看房信息：');
    if (info) {
        // 为标记点添加信息
        marker.info = info;
    }
    // 为每个标记点添加点击事件监听器
    marker.on('click', function () {
        if (this.info) {
            // 创建信息窗口
            var infoWindow = new AMap.InfoWindow({
                content: this.info,
                offset: new AMap.Pixel(0, -30)
            });
            // 打开信息窗口
            infoWindow.open(map, this.getPosition());
        }
    });
});