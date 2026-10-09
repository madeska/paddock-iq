import unittest
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from threadpoolctl import threadpool_limits
from export_tree_residual_model import export_tree_residual_model
class ExportTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  with threadpool_limits(limits=1):
   cls.model=HistGradientBoostingRegressor(loss='squared_error',learning_rate=.05,max_iter=60,max_leaf_nodes=4,min_samples_leaf=20,l2_regularization=10,early_stopping=False,random_state=42).fit(np.array([[(i*(j+1))%17 for j in range(10)] for i in range(100)],dtype=float),np.array([float(i%13) for i in range(100)]))
 def test_frozen_export_has_all_stages_and_scalar_base(self):
  exported=export_tree_residual_model(self.model,2026,18)
  self.assertEqual(len(exported['trees']),60);self.assertEqual(exported['featureCount'],10)
  self.assertEqual(exported['beforeRound'],18);self.assertEqual(exported['baseValue'],float(self.model._baseline_prediction[0,0]))
 def test_changed_hyperparameter_rejected(self):
  prior=self.model.learning_rate
  try:
   self.model.learning_rate=.2
   with self.assertRaises(ValueError):export_tree_residual_model(self.model,2026,18)
  finally:self.model.learning_rate=prior
 def test_nondefault_depth_rejected(self):
  prior=self.model.max_depth
  try:
   self.model.max_depth=2
   with self.assertRaises(ValueError):export_tree_residual_model(self.model,2026,18)
  finally:self.model.max_depth=prior
 def test_categorical_node_rejected(self):
  node=self.model._predictors[0][0].nodes[0];prior=int(node['is_categorical'])
  try:
   node['is_categorical']=1
   with self.assertRaises(ValueError):export_tree_residual_model(self.model,2026,18)
  finally:node['is_categorical']=prior
if __name__=='__main__':unittest.main()
