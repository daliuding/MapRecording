<template>
  <el-dialog
    v-model="dialogVisible"
    :title="editingMarker ? '编辑标记' : '新建标记'"
    width="600px"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="100px"
    >
      <el-form-item label="标记类型">
        <el-radio-group v-model="formData.type" :disabled="!!editingMarker">
          <el-radio label="house">房屋</el-radio>
          <el-radio label="community">小区</el-radio>
        </el-radio-group>
      </el-form-item>

      <!-- 房屋信息 -->
      <template v-if="formData.type === 'house'">
        <el-form-item label="小区名称" prop="info.community_name">
          <el-input v-model="formData.info.community_name" placeholder="请输入小区名称" />
        </el-form-item>
        <el-form-item label="楼栋号" prop="info.building">
          <el-input v-model="formData.info.building" placeholder="如：1号楼" />
        </el-form-item>
        <el-form-item label="楼层" prop="info.floor">
          <el-input v-model="formData.info.floor" placeholder="如：5层" />
        </el-form-item>
        <el-form-item label="是否有电梯">
          <el-switch v-model="formData.info.has_elevator" />
        </el-form-item>
        <el-form-item label="户型" prop="info.room_type">
          <el-input v-model="formData.info.room_type" placeholder="如：2室1厅" />
        </el-form-item>
        <el-form-item label="价格（元）" prop="info.price">
          <el-input-number
            v-model="formData.info.price"
            :min="0"
            :precision="0"
            style="width: 100%"
            placeholder="请输入价格"
          />
        </el-form-item>
        <el-form-item label="面积（㎡）" prop="info.area">
          <el-input-number
            v-model="formData.info.area"
            :min="0"
            :precision="2"
            style="width: 100%"
            placeholder="请输入面积"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="formData.info.notes"
            type="textarea"
            :rows="3"
            placeholder="其他备注信息"
          />
        </el-form-item>
      </template>

      <!-- 小区信息 -->
      <template v-else>
        <el-form-item label="小区名称" prop="info.name">
          <el-input v-model="formData.info.name" placeholder="请输入小区名称" />
        </el-form-item>
        <el-form-item label="建筑年代" prop="info.build_year">
          <el-input-number
            v-model="formData.info.build_year"
            :min="1900"
            :max="new Date().getFullYear()"
            style="width: 100%"
            placeholder="如：2010"
          />
        </el-form-item>
        <el-form-item label="物业公司" prop="info.property">
          <el-input v-model="formData.info.property" placeholder="请输入物业公司名称" />
        </el-form-item>
        <el-form-item label="物业费（元/月/㎡）" prop="info.property_fee">
          <el-input-number
            v-model="formData.info.property_fee"
            :min="0"
            :precision="2"
            style="width: 100%"
            placeholder="请输入物业费"
          />
        </el-form-item>
        <el-form-item label="总户数" prop="info.total_units">
          <el-input-number
            v-model="formData.info.total_units"
            :min="0"
            :precision="0"
            style="width: 100%"
            placeholder="请输入总户数"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="formData.info.notes"
            type="textarea"
            :rows="3"
            placeholder="其他备注信息"
          />
        </el-form-item>
      </template>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  visible: Boolean,
  markerType: {
    type: String,
    default: 'house'
  },
  position: Array,
  markerData: Object
})

const emit = defineEmits(['close', 'save'])

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => !val && emit('close')
})

const formRef = ref(null)
const editingMarker = computed(() => props.markerData)

const formData = ref({
  type: 'house',
  lng: 0,
  lat: 0,
  info: {}
})

const rules = {
  'info.community_name': [{ required: true, message: '请输入小区名称', trigger: 'blur' }],
  'info.name': [{ required: true, message: '请输入小区名称', trigger: 'blur' }]
}

// 初始化表单数据
function initFormData() {
  if (editingMarker.value) {
    // 编辑模式
    formData.value = {
      id: editingMarker.value.id,
      type: editingMarker.value.type,
      lng: editingMarker.value.lng,
      lat: editingMarker.value.lat,
      info: { ...editingMarker.value.info }
    }
  } else {
    // 新建模式
    formData.value = {
      type: props.markerType,
      lng: props.position?.[0] || 0,
      lat: props.position?.[1] || 0,
      info: {
        community_name: '',
        building: '',
        floor: '',
        has_elevator: false,
        room_type: '',
        price: null,
        area: null,
        notes: '',
        name: '',
        build_year: null,
        property: '',
        property_fee: null,
        total_units: null
      }
    }
  }
}

// 监听 visible 变化，初始化表单
watch(() => props.visible, (val) => {
  if (val) {
    initFormData()
  }
}, { immediate: true })

// 关闭
function handleClose() {
  emit('close')
}

// 保存
async function handleSave() {
  if (!formRef.value) return
  
  await formRef.value.validate((valid) => {
    if (valid) {
      const markerData = {
        marker: {
          id: formData.value.id,
          type: formData.value.type,
          lng: formData.value.lng,
          lat: formData.value.lat
        },
        info: { ...formData.value.info }
      }
      
      // 清理空值
      Object.keys(markerData.info).forEach(key => {
        if (markerData.info[key] === '' || markerData.info[key] === null) {
          delete markerData.info[key]
        }
      })
      
      emit('save', markerData)
    } else {
      ElMessage.warning('请填写必填项')
    }
  })
}
</script>
