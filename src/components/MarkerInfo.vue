<template>
  <el-dialog
    v-model="dialogVisible"
    :title="marker?.type === 'house' ? '房屋信息' : '小区信息'"
    width="600px"
    @close="handleClose"
  >
    <div v-if="marker" class="marker-info">
      <el-descriptions :column="2" border>
        <template v-if="marker.type === 'house'">
          <el-descriptions-item label="小区名称">
            {{ marker.info?.community_name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="楼栋号">
            {{ marker.info?.building || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="楼层">
            {{ marker.info?.floor || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="是否有电梯">
            {{ marker.info?.has_elevator ? '是' : '否' }}
          </el-descriptions-item>
          <el-descriptions-item label="户型">
            {{ marker.info?.room_type || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="价格">
            {{ marker.info?.price ? `${marker.info.price.toLocaleString()} 元` : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="面积">
            {{ marker.info?.area ? `${marker.info.area} ㎡` : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">
            {{ marker.info?.notes || '-' }}
          </el-descriptions-item>
        </template>
        
        <template v-else>
          <el-descriptions-item label="小区名称">
            {{ marker.info?.name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="建筑年代">
            {{ marker.info?.build_year || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="物业公司">
            {{ marker.info?.property || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="物业费">
            {{ marker.info?.property_fee ? `${marker.info.property_fee} 元/月/㎡` : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="总户数">
            {{ marker.info?.total_units || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">
            {{ marker.info?.notes || '-' }}
          </el-descriptions-item>
        </template>
      </el-descriptions>
    </div>

    <template #footer>
      <el-button type="danger" @click="handleDelete">删除</el-button>
      <el-button type="primary" @click="handleEdit">编辑</el-button>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: Boolean,
  marker: Object
})

const emit = defineEmits(['close', 'edit', 'delete'])

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => !val && emit('close')
})

function handleClose() {
  emit('close')
}

function handleEdit() {
  emit('edit')
}

function handleDelete() {
  emit('delete')
}
</script>

<style scoped>
.marker-info {
  padding: 10px 0;
}
</style>
