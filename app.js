import * as THREE from 'three';
import { OrbitControls } from './assets/vendor/three/OrbitControls.js';
import { STLLoader } from './assets/vendor/three/STLLoader.js';

const state = {
  rotations: { x: 0, y: 0, z: 0 },
  zoom: 1,
  generating: false,
  modelName: '齿轮箱 · 扫描网格',
};

const $ = (id) => document.getElementById(id);
const fileInput = $('fileInput');
const toastEl = $('toast');
let toastTimer;
let threeView;

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 2600);
}

function setJobStatus(text, progress = 100, active = false) {
  $('jobStatus').querySelector('span').textContent = text;
  const light = $('jobStatus').querySelector('.status-light');
  light.style.background = `linear-gradient(90deg, ${active ? '#d89632' : '#15a859'} 0 ${Math.max(8, progress)}%, #eef1f2 ${Math.max(8, progress)}% 100%)`;
}

async function loadExistingStlAssembly(assembly) {
  try {
    setJobStatus('正在载入扫描网格', 24, true);
    const loader = new STLLoader();
    const parts = [
      ['base.stl', [0, -0.8, 0], 0x707d80],
      ['skin 1.stl', [0, 0.05, 0], 0x89979a],
      ['bottom gear.stl', [0, 0.68, 0], 0xc28a32],
      ['bottom middle-man.stl', [0, 1.1, 0], 0x94a1a4],
      ['rotor-body1.stl', [0, 1.54, 0], 0x6f7d81],
      ['rotor-body2.stl', [0, 1.86, 0], 0x7f8d90],
      ['rotor-body3.stl', [0, 2.14, 0], 0x8f9a9d],
      ['upper gear.stl', [0, 2.5, 0], 0xd39a31],
      ['top middle-man.stl', [0, 2.9, 0], 0x94a1a4],
      ['skin 2.stl', [0, 3.48, 0], 0x89979a],
      ['magnet_holder.stl', [0, 4.0, 0], 0x3f78a1],
      ['spacer 8x4x5 v3 - print 5.stl', [0, 4.42, 0], 0x4f5a5d],
    ];
    const loaded = await Promise.all(parts.map(([file, position, color]) => new Promise((resolve, reject) => {
      loader.load(`assets/open-source-model/kira-gearbox/${encodeURIComponent(file)}`, (geometry) => {
        geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0.16 }));
        mesh.position.set(...position);
        resolve(mesh);
      }, undefined, reject);
    })));
    const imported = new THREE.Group();
    loaded.forEach((mesh) => imported.add(mesh));
    const bounds = new THREE.Box3().setFromObject(imported);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const scale = 7.0 / Math.max(size.x, size.y, size.z);
    imported.scale.setScalar(scale);
    imported.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    assembly.add(imported);
    setJobStatus('扫描网格已载入', 100, false);
    toast('扫描网格已载入，可用滑块或鼠标旋转。');
  } catch (error) {
    setJobStatus('扫描网格加载失败', 100, false);
    toast('扫描网格加载失败，请检查模型资源。');
    console.error(error);
  }
}

function initThreeView() {
  const host = $('modelCanvas');
  if (!host) return;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeef2f4);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(10.5, 7.3, 10.5);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0.9, 0);
  controls.minDistance = 6;
  controls.maxDistance = 25;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x73828a, 2.4));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(6, 10, 8);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x9fc7e7, 1.1);
  fillLight.position.set(-8, 4, -6);
  scene.add(fillLight);
  const assembly = new THREE.Group();
  scene.add(assembly);
  threeView = { scene, camera, renderer, controls, assembly };
  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  window.addEventListener('resize', resize);
  resize();
  const render = () => {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  };
  render();
  loadExistingStlAssembly(assembly);
}

function updatePose() {
  const { x, y, z } = state.rotations;
  $('rotXValue').textContent = `${x}°`;
  $('rotYValue').textContent = `${y}°`;
  $('rotZValue').textContent = `${z}°`;
  $('poseValue').textContent = `X ${x}° · Y ${y}° · Z ${z}°`;
  if (threeView) {
    threeView.assembly.rotation.set(THREE.MathUtils.degToRad(x), THREE.MathUtils.degToRad(y), THREE.MathUtils.degToRad(z));
    threeView.camera.zoom = state.zoom;
    threeView.camera.updateProjectionMatrix();
  }
}

function syncSliderValues() {
  $('rotX').value = state.rotations.x;
  $('rotY').value = state.rotations.y;
  $('rotZ').value = state.rotations.z;
  updatePose();
}

function switchTab(tab) {
  const preview = tab === 'preview';
  $('previewTab').classList.toggle('active', preview);
  $('engineeringTab').classList.toggle('active', !preview);
  $('previewTab').setAttribute('aria-selected', String(preview));
  $('engineeringTab').setAttribute('aria-selected', String(!preview));
  $('previewPanel').classList.toggle('hidden', !preview);
  $('engineeringPanel').classList.toggle('hidden', preview);
}

function simulateGeneration() {
  if (state.generating) return;
  state.generating = true;
  let progress = 0;
  setJobStatus('正在生成工程图', progress, true);
  $('generateBtn').disabled = true;
  $('generateBtn').textContent = '载入中…';
  const timer = setInterval(() => {
    progress += Math.round(Math.random() * 17) + 8;
    if (progress >= 100) {
      progress = 100;
      clearInterval(timer);
      state.generating = false;
      $('generateBtn').disabled = false;
      $('generateBtn').textContent = '生成工程图';
      setJobStatus('工程图已生成', 100, false);
      switchTab('engineering');
      toast('工程图已生成，低置信度圆角特征建议人工复核。');
      return;
    }
    setJobStatus('正在生成工程图', progress, true);
  }, 170);
}

function handleImport(file) {
  if (!file) return;
  state.modelName = file.name;
  $('modelName').textContent = file.name;
  $('vertexCount').textContent = '扫描中…';
  $('faceCount').textContent = '扫描中…';
  setJobStatus('正在读取点云', 12, true);
  let progress = 12;
  const timer = setInterval(() => {
    progress += 18;
    setJobStatus('正在读取点云', progress, true);
    if (progress >= 100) {
      clearInterval(timer);
      $('vertexCount').textContent = '544,273';
      $('faceCount').textContent = '1,088,798';
      setJobStatus('模型已载入', 100, false);
      toast(`${file.name} 已载入，点云预处理完成。`);
    }
  }, 180);
}

function runAssistant() {
  const reply = $('assistantReply');
  reply.innerHTML = '<span class="reply-dot active"></span><span>AI 正在分割平面、圆柱、孔位与倒角…</span>';
  setJobStatus('AI 特征识别中', 68, true);
  $('assistantBtn').disabled = true;
  setTimeout(() => {
    reply.innerHTML = '<span class="reply-dot active"></span><span>已识别 6 个高置信度特征；倒角 91.4%，圆角 84.8%，建议人工复核后导出 STEP。</span>';
    $('assistantBtn').disabled = false;
    setJobStatus('特征识别已完成', 100, false);
    toast('AI 识别完成：4 类特征进入参数化重建。');
  }, 1200);
}

function exportPdf() {
  const anchor = document.createElement('a');
  anchor.href = 'assets/open-source-drawing/three-stage-gearbox-drawing.pdf';
  anchor.download = '齿轮箱_工程图.pdf';
  anchor.target = '_blank';
  anchor.rel = 'noreferrer';
  anchor.click();
  toast('工程图文件已打开。');
}

['rotX', 'rotY', 'rotZ'].forEach((id) => {
  $(id).addEventListener('input', (event) => {
    const axis = id.slice(-1).toLowerCase();
    state.rotations[axis] = Number(event.target.value);
    updatePose();
  });
});

$('importBtn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (event) => handleImport(event.target.files[0]));
$('generateBtn').addEventListener('click', simulateGeneration);
$('exportBtn').addEventListener('click', exportPdf);
$('alignBtn').addEventListener('click', () => {
  state.rotations = { x: 0, y: 0, z: 0 };
  syncSliderValues();
  setJobStatus('主轴已自动对齐', 100, false);
  toast('已按最小包围盒完成主轴对齐。');
});
$('restoreBtn').addEventListener('click', () => {
  state.rotations = { x: 0, y: 0, z: 0 };
  syncSliderValues();
  toast('已恢复扫描文件的原始姿态。');
});
$('applyRotationBtn').addEventListener('click', () => toast('当前姿态已应用到三视图预览。'));
$('clearRotationBtn').addEventListener('click', () => {
  state.rotations = { x: 0, y: 0, z: 0 };
  syncSliderValues();
  toast('预览角度已清零。');
});
$('previewTab').addEventListener('click', () => switchTab('preview'));
$('engineeringTab').addEventListener('click', () => switchTab('engineering'));
$('assistantBtn').addEventListener('click', runAssistant);
$('directionSelect').addEventListener('change', (event) => toast(`已将${event.target.options[event.target.selectedIndex].text}设为主视图方向。`));
$('zoomInBtn').addEventListener('click', () => {
  state.zoom = Math.min(1.35, state.zoom + 0.1);
  $('zoomValue').textContent = `${Math.round(state.zoom * 100)}%`;
  updatePose();
});
$('zoomOutBtn').addEventListener('click', () => {
  state.zoom = Math.max(0.75, state.zoom - 0.1);
  $('zoomValue').textContent = `${Math.round(state.zoom * 100)}%`;
  updatePose();
});

syncSliderValues();
initThreeView();
updatePose();
