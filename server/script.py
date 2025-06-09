import cv2
import sys
import json

# Cargar clases
with open('coco.names', 'r') as f:
    classes = [line.strip() for line in f.readlines()]

# Cargar red YOLOv4-tiny
net = cv2.dnn.readNet('yolov4-tiny.weights', 'yolov4-tiny.cfg')
net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)

imagen_path = 'captura.jpg'
img = cv2.imread(imagen_path)
if img is None:
    print(json.dumps([]))
    sys.exit(0)

height, width = img.shape[:2]
blob = cv2.dnn.blobFromImage(img, 1/255.0, (416, 416), swapRB=True, crop=False)
net.setInput(blob)

# Obtener nombres de capas de salida
layer_names = net.getLayerNames()
output_layers = [layer_names[i - 1] for i in net.getUnconnectedOutLayers()]

# Forward pass
layer_outputs = net.forward(output_layers)

objects = set()
conf_threshold = 0.3
nms_threshold = 0.4
boxes = []
confidences = []
class_ids = []

# Procesar detecciones
for output in layer_outputs:
    for detection in output:
        scores = detection[5:]
        class_id = int(scores.argmax())
        confidence = scores[class_id]

        if confidence > conf_threshold:
            center_x = int(detection[0] * width)
            center_y = int(detection[1] * height)
            w = int(detection[2] * width)
            h = int(detection[3] * height)
            x = int(center_x - w / 2)
            y = int(center_y - h / 2)

            boxes.append([x, y, w, h])
            confidences.append(float(confidence))
            class_ids.append(class_id)

# Aplicar Non-Maximum Suppression
indices = cv2.dnn.NMSBoxes(boxes, confidences, conf_threshold, nms_threshold)

for i in indices:
    i = i[0] if isinstance(i, (list, tuple, np.ndarray)) else i
    x, y, w, h = boxes[i]
    label = classes[class_ids[i]]
    objects.add(label)

    # Dibujar caja y etiqueta
    cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 0), 2)
    cv2.putText(img, label, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX,
                0.5, (0, 255, 0), 2)

# Guardar imagen con boxes
cv2.imwrite(imagen_path, img)

# Devolver objetos detectados como JSON
print(json.dumps(list(objects)))
