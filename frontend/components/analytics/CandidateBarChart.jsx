import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CandidateBarChart = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" />
        <YAxis dataKey="candidateName" type="category" width={120} />
        <Tooltip />
        <Bar dataKey="totalApplications" fill="#82ca9d" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default CandidateBarChart;
