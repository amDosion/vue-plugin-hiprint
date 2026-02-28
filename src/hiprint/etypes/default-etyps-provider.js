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
            icon: "glyphicon-text-width"
          },
          {
            tid: "defaultModule.image",
            title: "图片",
            data: "",
            type: "image",
            icon: "glyphicon-picture"
          },
          {
            tid: "defaultModule.longText",
            title: "长文",
            data: "155123456789",
            type: "longText",
            icon: "glyphicon-subscript"
          },
          {
            tid: "defaultModule.table",
            field: "table",
            title: "表格",
            type: "table",
            icon: "glyphicon-th",
            groupFields: ["name"],
            groupFooterFormatter: function (group, option) {
              return "这里自定义统计脚信息";
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
            icon: "glyphicon-th",
            columns: [
              [
                { title: "", field: "", width: 100 },
                { title: "", field: "", width: 100 }
              ]
            ],
          },
          {
            tid: "defaultModule.html",
            title: "html",
            icon: "glyphicon-header",
            formatter: function (data, options) {
              return '<div style="height:50pt;width:50pt;background:red;border-radius: 50%;"></div>';
            },
            type: "html"
          },
          {
            tid: "defaultModule.customText",
            title: "自定义文本",
            customText: "自定义文本",
            custom: true,
            type: "text",
            icon: "glyphicon-text-width"
          },
          {
            tid: "defaultModule.titleRow",
            title: "标题行",
            type: "text",
            icon: "glyphicon-minus",
            options: {
              width: 550,
              height: 18,
              fontSize: 14.25,
              fontWeight: "bold",
              textAlign: "left",
              backgroundColor: "#F2F6FC",
              contentPaddingLeft: 6,
              textContentVerticalAlign: "middle",
            }
          }
        ]),
        new hiprint.PrintElementTypeGroup("电商", [
          {
            tid: "defaultModule.url",
            title: "链接",
            type: "text",
            icon: "glyphicon-link",
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
            icon: "glyphicon-yen",
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
            icon: "glyphicon-tag",
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
            icon: "glyphicon-send",
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
            icon: "glyphicon-user",
            options: {
              width: 240,
              height: 42,
              fontSize: 12,
              fontWeight: "bold",
              lineHeight: 15,
            }
          }
        ]),
        new hiprint.PrintElementTypeGroup("辅助", [
          {
            tid: "defaultModule.hline",
            title: "横线",
            type: "hline",
            icon: "glyphicon-resize-horizontal"
          },
          {
            tid: "defaultModule.vline",
            title: "竖线",
            type: "vline",
            icon: "glyphicon-resize-vertical"
          },
          {
            tid: "defaultModule.rect",
            title: "矩形",
            type: "rect",
            icon: "glyphicon-unchecked"
          },
          {
            tid: "defaultModule.oval",
            title: "椭圆",
            type: "oval",
            icon: "glyphicon-record"
          },
          {
            tid: 'defaultModule.barcode',
            title: '条形码',
            type: 'barcode',
            icon: 'glyphicon-barcode'
          },
          {
            tid: 'defaultModule.qrcode',
            title: '二维码',
            type: 'qrcode',
            icon: 'glyphicon-qrcode'
          }
        ])
      ]);
    };
    return {
      addElementTypes: addElementTypes
    };
  };
};
