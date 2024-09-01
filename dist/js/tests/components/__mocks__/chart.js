export const mockChart = () => {
    const mockChartData = {
        data: undefined,
        options: {
            title: undefined,
        },
        type: undefined,
    };
    class ChartMock {
        constructor(ctx, chartData) {
            this.destroy = () => { };
            this.update = () => { };
            this.options = mockChartData.options;
            this.config = mockChartData;
            Object.assign(mockChartData, chartData);
        }
        set data(value) {
            mockChartData.data = value;
        }
        get data() {
            return mockChartData.data;
        }
    }
    //@ts-ignore
    window.Chart = ChartMock;
    return mockChartData;
};
//# sourceMappingURL=chart.js.map