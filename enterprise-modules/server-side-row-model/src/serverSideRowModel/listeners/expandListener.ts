import {
    _,
    Autowired,
    BeanStub,
    StoreUpdatedEvent,
    Events,
    GridOptionsWrapper,
    PostConstruct,
    RowGroupOpenedEvent,
    RowNode,
    Bean
} from "@ag-grid-community/core";
import { ServerSideRowModel } from "../serverSideRowModel";
import {StoreFactory} from "../stores/storeFactory";

@Bean('ssrmExpandListener')
export class ExpandListener extends BeanStub {

    @Autowired('gridOptionsWrapper') private gridOptionsWrapper: GridOptionsWrapper;
    @Autowired('rowModel') private serverSideRowModel: ServerSideRowModel;
    @Autowired('ssrmStoreFactory') private storeFactory: StoreFactory;

    @PostConstruct
    private postConstruct(): void {
        // only want to be active if SSRM active, otherwise would be interfering with other row models
        if (!this.gridOptionsWrapper.isRowModelServerSide()) { return; }

        this.addManagedListener(this.eventService, Events.EVENT_ROW_GROUP_OPENED, this.onRowGroupOpened.bind(this));
    }

    private onRowGroupOpened(event: RowGroupOpenedEvent): void {
        const rowNode: RowNode = event.node;

        if (rowNode.expanded) {
            if (rowNode.master) {
                this.createDetailNode(rowNode);
            } else if (_.missing(rowNode.childrenCache)) {
                const storeParams = this.serverSideRowModel.getParams();
                rowNode.childrenCache = this.createBean(this.storeFactory.createStore(storeParams, rowNode));
            }
        } else if (this.gridOptionsWrapper.isPurgeClosedRowNodes() && _.exists(rowNode.childrenCache)) {
            rowNode.childrenCache = this.destroyBean(rowNode.childrenCache)!;
        }

        const cacheUpdatedEvent: StoreUpdatedEvent = { type: Events.EVENT_STORE_UPDATED };
        this.eventService.dispatchEvent(cacheUpdatedEvent);
    }

    private createDetailNode(masterNode: RowNode): RowNode {
        if (_.exists(masterNode.detailNode)) { return masterNode.detailNode; }

        const detailNode = new RowNode();

        this.getContext().createBean(detailNode);

        detailNode.detail = true;
        detailNode.selectable = false;
        detailNode.parent = masterNode;

        if (_.exists(masterNode.id)) {
            detailNode.id = 'detail_' + masterNode.id;
        }

        detailNode.data = masterNode.data;
        detailNode.level = masterNode.level + 1;

        const defaultDetailRowHeight = 200;
        const rowHeight = this.gridOptionsWrapper.getRowHeightForNode(detailNode).height;

        detailNode.rowHeight = rowHeight ? rowHeight : defaultDetailRowHeight;
        masterNode.detailNode = detailNode;

        return detailNode;
    }

}