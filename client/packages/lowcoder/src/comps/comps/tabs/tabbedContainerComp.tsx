import { default as Tabs } from "antd/es/tabs";
import { JSONObject, JSONValue } from "util/jsonTypes";
import { CompAction, CompActionTypes, deleteCompAction, wrapChildAction } from "lowcoder-core";
import { DispatchType, RecordConstructorToView, wrapDispatch } from "lowcoder-core";
import { AutoHeightControl } from "comps/controls/autoHeightControl";
import { BooleanStateControl, booleanExposingStateControl, stringExposingStateControl } from "comps/controls/codeStateControl";
import { eventHandlerControl } from "comps/controls/eventHandlerControl";
import { TabsOptionControl } from "comps/controls/optionsControl";
import { styleControl } from "comps/controls/styleControl";
import { ContainerBodyStyle, ContainerBodyStyleType, ContainerHeaderStyle, ContainerHeaderStyleType, TabContainerStyle, TabContainerStyleType, heightCalculator, widthCalculator } from "comps/controls/styleControlConstants";
import { sameTypeMap, UICompBuilder, withDefault } from "comps/generators";
import { addMapChildAction } from "comps/generators/sameTypeMap";
import { NameConfig, NameConfigHidden, withExposingConfigs } from "comps/generators/withExposing";
import { NameGenerator } from "comps/utils";
import { ControlNode, Section, sectionNames } from "lowcoder-design";
import { HintPlaceHolder } from "lowcoder-design";
import _ from "lodash";
import React, { useCallback, useContext } from "react";
import styled, { css } from "styled-components";
import { IContainer } from "../containerBase/iContainer";
import { SimpleContainerComp } from "../containerBase/simpleContainerComp";
import { CompTree, mergeCompTrees } from "../containerBase/utils";
import {
  ContainerBaseProps,
  gridItemCompToGridItems,
  InnerGrid,
} from "../containerComp/containerView";
import { BackgroundColorContext } from "comps/utils/backgroundColorContext";
import { disabledPropertyView, hiddenPropertyView } from "comps/utils/propertyUtils";
import { trans } from "i18n";
import { BoolCodeControl } from "comps/controls/codeControl";
import { DisabledContext } from "comps/generators/uiCompBuilder";
import { EditorContext } from "comps/editorState";
import { checkIsMobile } from "util/commonUtils";
import { messageInstance } from "lowcoder-design";

const EVENT_OPTIONS = [
  {
    label: trans("tabbedContainer.switchTab"),
    value: "change",
    description: trans("tabbedContainer.switchTabDesc"),
  },
] as const;

const childrenMap = {
  tabs: TabsOptionControl,
  selectedTabKey: stringExposingStateControl("key", "Tab1"),
  containers: withDefault(sameTypeMap(SimpleContainerComp), {
    0: { layout: {}, items: {} },
    1: { layout: {}, items: {} },
  }),
  autoHeight: AutoHeightControl,
  onEvent: eventHandlerControl(EVENT_OPTIONS),
  disabled: BoolCodeControl,
  showHeader: withDefault(BooleanStateControl, "true"),
  style: styleControl(TabContainerStyle),
  headerStyle: styleControl(ContainerHeaderStyle),
  bodyStyle: styleControl(ContainerBodyStyle),
};

type ViewProps = RecordConstructorToView<typeof childrenMap>;
type TabbedContainerProps = ViewProps & { dispatch: DispatchType };
 
const getStyle = (
  style: TabContainerStyleType,
  headerStyle: ContainerHeaderStyleType,
  bodyStyle: ContainerBodyStyleType,
) => {
  return css`
    &.ant-tabs {
      overflow: hidden;
      border: ${style.borderWidth} solid ${style.border};
      border-radius: ${style.radius};
      padding: ${style.padding};
      background-color: ${style.background};
      background-image: ${style.backgroundImage};
      background-repeat: ${style.backgroundImageRepeat};
      background-size: ${style.backgroundImageSize};
      background-position: ${style.backgroundImagePosition};
      background-origin: ${style.backgroundImageOrigin};

      > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane {
        height: 100%;
        .react-grid-layout {
          border-radius: 0;
          background-color: ${bodyStyle.background || 'transparent'};
          background-image: ${bodyStyle.backgroundImage};
          background-repeat: ${bodyStyle.backgroundImageRepeat};
          background-size: ${bodyStyle.backgroundImageSize};
          background-position: ${bodyStyle.backgroundImagePosition};
          background-origin: ${bodyStyle.backgroundImageOrigin};

        }
      }

      > .ant-tabs-nav {
        background-color: ${headerStyle.headerBackground || 'transparent'};
        background-image: ${headerStyle.headerBackgroundImage};
        background-repeat: ${headerStyle.headerBackgroundImageRepeat};
        background-size: ${headerStyle.headerBackgroundImageSize};
        background-position: ${headerStyle.headerBackgroundImagePosition};
        background-origin: ${headerStyle.headerBackgroundImageOrigin};

        .ant-tabs-tab {
          div {
            color: ${style.tabText};
          }

          &.ant-tabs-tab-active div {
            color: ${style.accent};
          }
        }

        .ant-tabs-ink-bar {
          background-color: ${style.accent};
        }

        ::before {
          border-color: ${style.border};
        }
      }
    }
  `;
};

const StyledTabs = styled(Tabs)<{ 
  $style: TabContainerStyleType;
  $headerStyle: ContainerHeaderStyleType;
  $bodyStyle: ContainerBodyStyleType;
  $isMobile?: boolean; 
  $showHeader?: boolean;
}>`
  &.ant-tabs {
    height: 100%;
  }

  .ant-tabs-content-animated {
    transition-duration: 0ms;
  }

  .ant-tabs-content {
    height: 100%;
    // margin-top: -16px;
  }

  .ant-tabs-nav {
    display: ${(props) => (props.$showHeader ? "block" : "none")};
    padding: 0 ${(props) => (props.$isMobile ? 16 : 24)}px;
    background: white;
    margin: 0px;
  }

  .ant-tabs-tab + .ant-tabs-tab {
    margin: 0 0 0 20px;
  }

  .ant-tabs-nav-operations {
    margin-right: -24px;
  }

  ${(props) => props.$style && getStyle(
    props.$style,
    props.$headerStyle,
    props.$bodyStyle,
  )}
`;

const ContainerInTab = (props: ContainerBaseProps) => {
  return (
    <InnerGrid {...props} emptyRows={15} bgColor={"white"} hintPlaceholder={HintPlaceHolder} />
  );
};

const TabbedContainer = (props: TabbedContainerProps) => {
  let {
    tabs,
    containers,
    dispatch,
    style,
    headerStyle,
    bodyStyle,
  } = props;

  const visibleTabs = tabs.filter((tab) => !tab.hidden);
  const selectedTab = visibleTabs.find((tab) => tab.key === props.selectedTabKey.value);
  const activeKey = selectedTab
    ? selectedTab.key
    : visibleTabs.length > 0
    ? visibleTabs[0].key
    : undefined;

  const onTabClick = useCallback(
    (key: string, event: React.KeyboardEvent<Element> | React.MouseEvent<Element, MouseEvent>) => {
      // log.debug("onTabClick. event: ", event);
      const target = event.target;
      (target as any).parentNode.click
        ? (target as any).parentNode.click()
        : (target as any).parentNode.parentNode.click();
    },
    []
  );

  const editorState = useContext(EditorContext);
  const maxWidth = editorState.getAppSettings().maxWidth;
  const isMobile = checkIsMobile(maxWidth);
  const showHeader = props.showHeader.value;
  const paddingWidth = isMobile ? 8 : 0;

  const tabItems = visibleTabs.map((tab) => {
    const id = String(tab.id);
    const childDispatch = wrapDispatch(wrapDispatch(dispatch, "containers"), id);
    const containerProps = containers[id].children;
    const hasIcon = tab.icon.props.value;
    const label = (
      <>
        {tab.iconPosition === "left" && hasIcon && (
          <span style={{ marginRight: "4px" }}>{tab.icon}</span>
        )}
        {tab.label}
        {tab.iconPosition === "right" && hasIcon && (
          <span style={{ marginLeft: "4px" }}>{tab.icon}</span>
        )}
      </>
    );
    return {
      label,
      key: tab.key,
      forceRender: true,
      children: (
        <BackgroundColorContext.Provider value={bodyStyle.background}>
          <ContainerInTab
            layout={containerProps.layout.getView()}
            items={gridItemCompToGridItems(containerProps.items.getView())}
            positionParams={containerProps.positionParams.getView()}
            dispatch={childDispatch}
            autoHeight={props.autoHeight}
            containerPadding={[paddingWidth, 20]}
          />
        </BackgroundColorContext.Provider>
      )
    }
  })

  return (
    <div style={{padding: props.style.margin, height: '100%'}}>
    <StyledTabs
      activeKey={activeKey}
      $style={style}
      $headerStyle={headerStyle}
      $bodyStyle={bodyStyle}
      $showHeader={showHeader}
      onChange={(key) => {
        if (key !== props.selectedTabKey.value) {
          props.selectedTabKey.onChange(key);
          props.onEvent("change");
        }
      }}
      onTabClick={onTabClick}
      animated
      $isMobile={isMobile}
      // tabBarGutter={32}
      items={tabItems}
    >
    </StyledTabs>
    </div>
  );
};


export const TabbedContainerBaseComp = (function () {
  return new UICompBuilder(childrenMap, (props, dispatch) => {
    return (
      <DisabledContext.Provider value={props.disabled}>
        <TabbedContainer {...props} dispatch={dispatch} />
      </DisabledContext.Provider>
    );
  })
    .setPropertyViewFn((children) => {
      return (
        <>
          <Section name={sectionNames.basic}>
            {children.tabs.propertyView({
              title: trans("tabbedContainer.tab"),
              newOptionLabel: "Tab",
            })}
            {children.selectedTabKey.propertyView({ label: trans("prop.defaultValue") })}
          </Section>
        
          {["logic", "both"].includes(useContext(EditorContext).editorModeStatus) && (
            <Section name={sectionNames.interaction}>
              {children.onEvent.getPropertyView()}
              {disabledPropertyView(children)}
              {children.showHeader.propertyView({ label: trans("prop.showHeader") })}
              {hiddenPropertyView(children)}
            </Section>
          )}

          {["layout", "both"].includes(useContext(EditorContext).editorModeStatus) && (
            <>
              <Section name={sectionNames.layout}>
                {children.autoHeight.getPropertyView()}
              </Section>
              <Section name={sectionNames.style}>
                {children.style.getPropertyView()}
              </Section>
              {children.showHeader.getView() && (
                <Section name={"Header Style"}>
                  { children.headerStyle.getPropertyView() }
                </Section>
              )}
              <Section name={"Body Style"}>
                { children.bodyStyle.getPropertyView() }
              </Section>
            </>
          )}
        </>
      );
    })
    .build();
})();

class TabbedContainerImplComp extends TabbedContainerBaseComp implements IContainer {
  private syncContainers(): this {
    const tabs = this.children.tabs.getView();
    const ids: Set<string> = new Set(tabs.map((tab) => String(tab.id)));
    let containers = this.children.containers.getView();
    // delete
    const actions: CompAction[] = [];
    Object.keys(containers).forEach((id) => {
      if (!ids.has(id)) {
        // log.debug("syncContainers delete. ids=", ids, " id=", id);
        actions.push(wrapChildAction("containers", wrapChildAction(id, deleteCompAction())));
      }
    });
    // new
    ids.forEach((id) => {
      if (!containers.hasOwnProperty(id)) {
        // log.debug("syncContainers new containers: ", containers, " id: ", id);
        actions.push(
          wrapChildAction("containers", addMapChildAction(id, { layout: {}, items: {} }))
        );
      }
    });

    // log.debug("syncContainers. actions: ", actions);
    let instance = this;
    actions.forEach((action) => {
      instance = instance.reduce(action);
    });
    return instance;
  }

  override reduce(action: CompAction): this {
    if (action.type === CompActionTypes.CUSTOM) {
      const value = action.value as JSONObject;
      if (value.type === "push") {
        const itemValue = value.value as JSONObject;
        if (_.isEmpty(itemValue.key)) itemValue.key = itemValue.label;
        action = {
          ...action,
          value: {
            ...value,
            value: { ...itemValue },
          },
        } as CompAction;
      }
      if (value.type === "delete" && this.children.tabs.getView().length <= 1) {
        messageInstance.warning(trans("tabbedContainer.atLeastOneTabError"));
        // at least one tab
        return this;
      }
    }
    // log.debug("before super reduce. action: ", action);
    let newInstance = super.reduce(action);
    if (action.type === CompActionTypes.UPDATE_NODES_V2) {
      // Need eval to get the value in StringControl
      newInstance = newInstance.syncContainers();
    }
    // log.debug("reduce. instance: ", this, " newInstance: ", newInstance);
    return newInstance;
  }

  realSimpleContainer(key?: string): SimpleContainerComp | undefined {
    let selectedTabKey = this.children.selectedTabKey.getView().value;
    const tabs = this.children.tabs.getView();
    const selectedTab = tabs.find((tab) => tab.key === selectedTabKey) ?? tabs[0];
    const id = String(selectedTab.id);
    if (_.isNil(key)) return this.children.containers.children[id];
    return Object.values(this.children.containers.children).find((container) =>
      container.realSimpleContainer(key)
    );
  }

  getCompTree(): CompTree {
    const containerMap = this.children.containers.getView();
    const compTrees = Object.values(containerMap).map((container) => container.getCompTree());
    return mergeCompTrees(compTrees);
  }

  findContainer(key: string): IContainer | undefined {
    const containerMap = this.children.containers.getView();
    for (const container of Object.values(containerMap)) {
      const foundContainer = container.findContainer(key);
      if (foundContainer) {
        return foundContainer === container ? this : foundContainer;
      }
    }
    return undefined;
  }

  getPasteValue(nameGenerator: NameGenerator): JSONValue {
    const containerMap = this.children.containers.getView();
    const containerPasteValueMap = _.mapValues(containerMap, (container) =>
      container.getPasteValue(nameGenerator)
    );

    return { ...this.toJsonValue(), containers: containerPasteValueMap };
  }

  override autoHeight(): boolean {
    return this.children.autoHeight.getView();
  }


}

export const TabbedContainerComp = withExposingConfigs(TabbedContainerImplComp, [
  new NameConfig("selectedTabKey", trans("tabbedContainer.selectedTabKeyDesc")),
  NameConfigHidden,
]);
