// 签名图占位：透明虚线方框，提示用户这里上传签名图。
// 与"签名"标签组件分离 —— 标签是模板固定部分，签名图是运行时数据。
const SIGNATURE_IMAGE_PLACEHOLDER_SRC = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60" preserveAspectRatio="none">'
  + '<rect x="1" y="1" width="158" height="58" fill="none" stroke="#bfbfbf" stroke-width="1" stroke-dasharray="4,3"/>'
  + '<text x="80" y="35" text-anchor="middle" font-size="11" fill="#bfbfbf" font-family="SimSun, sans-serif">点此上传签名</text>'
  + '</svg>'
);

// 印章占位：圆形红色虚线 + "印章"文字，用户上传真实印章图后替换 src
const SEAL_PLACEHOLDER_SRC = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">'
  + '<circle cx="40" cy="40" r="36" fill="none" stroke="#d4380d" stroke-width="2" stroke-dasharray="4,3"/>'
  + '<text x="40" y="48" text-anchor="middle" font-size="18" fill="#d4380d" font-weight="bold" font-family="SimSun, sans-serif">印章</text>'
  + '</svg>'
);

export default function (hiprint) {
  return function (options) {
    var addElementTypes = function (context) {
      context.removePrintElementTypes("defaultModule");
      context.addPrintElementTypes("defaultModule", [
        new hiprint.PrintElementTypeGroup("常规", [
          {
            tid: "defaultModule.text",
            title: "文本",
            data: "",
            type: "text",
            icon: "ep:document"
          },
          {
            tid: "defaultModule.image",
            title: "图片",
            data: "",
            type: "image",
            icon: "ep:picture"
          },
          {
            tid: "defaultModule.longText",
            title: "长文",
            data: "155123456789",
            type: "longText",
            icon: "ep:tickets"
          },
          {
            tid: "defaultModule.table",
            field: "table",
            title: "表格",
            type: "table",
            icon: "ep:grid",
            groupFields: ["name"],
            // 把默认 formatter 同时放在 options 里：拖入表格后属性面板"高级 → 分组脚格式化函数"
            // 的 textarea 直接显示这段代码，用户可以在 UI 里改。也方便外部项目通过模板 JSON
            // (element.options.groupFooterFormatter) 直接覆盖。
            // hiprint 标准签名：function(colTotal, tableData, printData, groupData, options) { return 'html string' }
            options: {
              groupFooterFormatter: 'function(colTotal, tableData, printData, groupData, options) {\n  // 返回分组脚一行的 HTML 字符串\n  // colTotal: 当前列数；tableData: 该分组的数据数组\n  return "分组小计：共 " + (tableData ? tableData.length : 0) + " 条";\n}',
            },
            columns: [
              [
                {
                  title: "行号",
                  fixed: true,
                  rowspan: 2,
                  field: "id",
                  width: 70
                },
                {title: "人员信息", colspan: 2},
                {title: "销售统计", colspan: 2}
              ],
              [
                {
                  title: "姓名",
                  align: "left",
                  field: "name",
                  width: 100
                },
                {title: "性别", field: "gender", width: 100},
                {
                  title: "销售数量",
                  field: "count",
                  width: 100
                },
                {
                  title: "销售金额",
                  field: "amount",
                  width: 100
                }
              ]
            ],
            editable: true,
            columnDisplayEditable: true,
            columnDisplayIndexEditable: true,
            columnTitleEditable: true,
            columnResizable: true,
            columnAlignEditable: true,
            isEnableEditField: true,
            isEnableContextMenu: true,
            isEnableInsertRow: true,
            isEnableDeleteRow: true,
            isEnableInsertColumn: true,
            isEnableDeleteColumn: true,
            isEnableMergeCell: true,
          },
          {
            tid: "defaultModule.emptyTable",
            title: "空表格",
            type: "table",
            icon: "ep:grid",
            columns: [
              [
                { title: "列 1", field: "col1", width: 100 },
                { title: "列 2", field: "col2", width: 100 }
              ]
            ],
            // 与 defaultModule.table 一致地开启列管理能力，
            // 否则属性面板"列字段"里的 stopPropagation/拖排序绑定会被短路
            editable: true,
            columnDisplayEditable: true,
            columnDisplayIndexEditable: true,
            columnTitleEditable: true,
            columnResizable: true,
            columnAlignEditable: true,
            isEnableEditField: true,
            isEnableContextMenu: true,
            isEnableInsertRow: true,
            isEnableDeleteRow: true,
            isEnableInsertColumn: true,
            isEnableDeleteColumn: true,
            isEnableMergeCell: true,
          },
          {
            tid: "defaultModule.html",
            title: "html",
            icon: "ep:postcard",
            formatter: function (data, options) {
              // width/height 用 100% 跟随外框尺寸（之前硬编码 50pt × 50pt 不会联动）。
              // 内容默认占位用虚线框 + 灰色文字提示，提示用户这是 HTML 容器，
              // 实际使用时通过 options.formatter 或 data 传入真正的 HTML 字符串。
              if (data) return data;
              return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;'
                   + 'border:1px dashed #c0c4cc;color:#909399;font-size:12px;box-sizing:border-box;'
                   + 'background:#fafbfc;">自定义 HTML</div>';
            },
            type: "html"
          },
          {
            tid: "defaultModule.customText",
            title: "自定义文本",
            customText: "自定义文本",
            custom: true,
            type: "text",
            icon: "ep:edit-pen"
          },
          {
            tid: "defaultModule.titleRow",
            title: "标题行",
            type: "text",
            icon: "ep:minus",
            options: {
              width: 540,
              height: 18,
              fontSize: 14.25,
              fontWeight: "bold",
              textAlign: "center",
              backgroundColor: "#F2F6FC",
              textContentVerticalAlign: "middle",
            }
          }
        ]),
        new hiprint.PrintElementTypeGroup("电商", [
          {
            tid: "defaultModule.url",
            title: "链接",
            type: "text",
            icon: "ep:link",
            options: {
              width: 180,
              height: 9.75,
              color: "#409eff",
              textDecoration: "underline",
            }
          },
          {
            tid: "defaultModule.price",
            title: "价格",
            type: "text",
            icon: "ep:money",
            options: {
              width: 80,
              height: 12,
              fontSize: 12,
              fontWeight: "bold",
              color: "#f56c6c",
              textAlign: "right",
            }
          },
          {
            tid: "defaultModule.sku",
            title: "SKU",
            type: "text",
            icon: "ep:price-tag",
            options: {
              width: 120,
              height: 9.75,
              fontSize: 9,
              color: "#909399",
            }
          },
          {
            tid: "defaultModule.senderInfo",
            title: "寄件人信息",
            type: "longText",
            icon: "ep:promotion",
            options: {
              width: 240,
              height: 42,
              fontSize: 9,
              lineHeight: 13.5,
            }
          },
          {
            tid: "defaultModule.receiverInfo",
            title: "收件人信息",
            type: "longText",
            icon: "ep:user",
            options: {
              width: 240,
              height: 42,
              fontSize: 12,
              fontWeight: "bold",
              lineHeight: 15,
            }
          },
          {
            // 订单号：text 标准用法（title + "：" + data），field 默认绑 orderNo
            tid: "defaultModule.orderNo",
            title: "订单号",
            field: "orderNo",
            type: "text",
            icon: "ep:tickets",
            options: {
              width: 200,
              height: 12,
              fontSize: 10,
              testData: "DD20260509001",
            }
          },
          {
            // 业务下单日期（区别于"实用-当前日期"——后者是当前打印时间）。
            // 用户传什么字符串就显示什么，业务方负责格式化好后再传入。
            tid: "defaultModule.orderDate",
            title: "下单日期",
            field: "orderDate",
            type: "text",
            icon: "ep:calendar",
            options: {
              width: 160,
              height: 12,
              fontSize: 10,
              testData: "2026-05-09 14:30",
            }
          },
          {
            // 快递单号：text + textType=barcode，扫码直接追踪物流。default barcodeType=code128 兼容性最好。
            // 用 textType 而非 type:'barcode'，统一渲染管道，用户可在属性面板切换为文本/二维码/图片。
            tid: "defaultModule.trackingNo",
            title: "快递单号",
            field: "trackingNo",
            type: "text",
            icon: "ep:list",
            options: {
              width: 180,
              height: 50,
              textType: "barcode",
              barcodeType: "code128",
              testData: "SF1234567890",
            }
          },
          {
            // 金额合计：突出显示——红色加粗 + 右对齐 + 大字号。
            // 业务方传入数据时已包含 ¥ 前缀和小数（例如 "¥ 1234.56"），与订单号保持一致的纯文本行为。
            tid: "defaultModule.totalAmount",
            title: "金额合计",
            field: "totalAmount",
            type: "text",
            icon: "ep:money",
            options: {
              width: 120,
              height: 14,
              fontSize: 12,
              fontWeight: "bold",
              color: "#f56c6c",
              textAlign: "right",
              testData: "¥ 1234.56",
            }
          }
        ]),
        new hiprint.PrintElementTypeGroup("辅助", [
          {
            tid: "defaultModule.hline",
            title: "横线",
            type: "hline",
            icon: "ep:minus"
          },
          {
            tid: "defaultModule.vline",
            title: "竖线",
            type: "vline",
            icon: "ep:more-filled"
          },
          {
            tid: "defaultModule.rect",
            title: "矩形",
            type: "rect",
            icon: "ep:crop"
          },
          {
            tid: "defaultModule.oval",
            title: "椭圆",
            type: "oval",
            icon: "ep:aim"
          },
          {
            // 条形码：text + textType=barcode（统一渲染管道，可在属性面板切换为 text/qrcode/image）。
            // 必须有 field —— hiprint 内部 updateTargetText 在 textType=barcode 分支
            // 无 field 时会把 title 作为 barcode 编码内容渲染，
            // "条形码" 中文字符 code128 不支持，会显示"此格式不支持该文本"。
            // 业务方传入数据时通过 templateData.barcode 字段提供编码。
            tid: 'defaultModule.barcode',
            title: '条形码',
            field: 'barcode',
            type: 'text',
            icon: 'ep:list',
            options: {
              width: 140,
              height: 35,
              textType: 'barcode',
              hideTitle: true,
              testData: '123456789',
            }
          },
          {
            // 二维码：text + textType=qrcode，渲染走 hiprint 内部 QR 库。
            // 同样必须有 field（理由同条形码）。业务方通过 templateData.qrcode 字段传入二维码内容。
            tid: 'defaultModule.qrcode',
            title: '二维码',
            field: 'qrcode',
            type: 'text',
            icon: 'ep:grid',
            options: {
              width: 50,
              height: 50,
              textType: 'qrcode',
              hideTitle: true,
              testData: 'https://example.com',
            }
          }
        ]),
        new hiprint.PrintElementTypeGroup("实用", [
          {
            // 当前打印日期（每次打印自动取系统时间，与"电商-下单日期"区别：那是业务订单日期）
            // 注意 hiprint text 元素 formatter 签名：(title, data, options, templateData, target)
            // 第一个形参是 title 不是 data，之前写错过参数顺序。
            tid: "defaultModule.currentDate",
            title: "当前日期",
            type: "text",
            icon: "ep:calendar",
            options: {
              width: 100,
              height: 12,
              fontSize: 9,
              textAlign: "left",
            },
            formatter: function (title, data, options, templateData) {
              var src = (templateData && (templateData.currentDate || templateData.printDate || templateData.date))
                       || data || new Date();
              try {
                var dt = src instanceof Date ? src : new Date(src);
                if (isNaN(dt.getTime())) dt = new Date();
                var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
                return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
              } catch (e) {
                return '';
              }
            },
          },
          {
            // 走 hiprint 标准 text 行为：title + "：" + data（就像"姓名：张三"）。
            // 关键：预设 field 让 element 拖入即"有 field 绑定"，hiprint 自动渲染 "签名："前缀；
            // 不要再设 printElementType.data（会变成兜底数据，导致 "签名：签名："拼接）。
            // - 拖入即看到："签名：" + 下边框（field 已绑、testData 空）
            // - testData 填"张三"：画布显示 "签名：张三"（设计期预览）
            // - 运行期 template.print({ signature: "李四" })：画布显示 "签名：李四"
            // - 用户改 field 为别的字段名（如 signerName）：覆盖默认绑定
            tid: "defaultModule.signature",
            title: "签名",
            field: "signature",
            type: "text",
            icon: "ep:edit-pen",
            options: {
              width: 220,
              height: 32,
              fontSize: 11,
              textAlign: "left",
              contentPaddingLeft: 4,
              borderBottom: "solid",
              borderWidth: 0.75,
              borderColor: "#000000",
              textContentVerticalAlign: "bottom",
            },
          },
          {
            // 运行时数据部分：可上传/绑 field 的签名图。建议叠加在"签名"组件的虚线之上。
            // 拖入后默认占位是透明虚线方框，提示用户在右侧"基础 → 图片地址"上传或绑定。
            tid: "defaultModule.signatureImage",
            title: "签名图",
            type: "image",
            icon: "ep:edit-pen",
            options: {
              width: 160,
              height: 60,
              src: SIGNATURE_IMAGE_PLACEHOLDER_SRC,
              fit: "contain",
            },
          },
          {
            // 同上：占位是红色虚线圆 + "印章"，用户上传真实印章图后 src 自动替换。
            tid: "defaultModule.seal",
            title: "印章",
            type: "image",
            icon: "ep:medal",
            options: {
              width: 80,
              height: 80,
              src: SEAL_PLACEHOLDER_SRC,
              fit: "contain",
            },
          },
        ])
      ]);
    };
    return {
      addElementTypes: addElementTypes
    };
  };
};
