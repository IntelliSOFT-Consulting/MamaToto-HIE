**NOTE**: This is the old query library (and examples) which is in maintenance
mode and will be deprecated in the future. Our new approach is SQL based. At
the moment it uses direct SQL statements but will eventually be based on
[FHIR-views](https://github.com/google/fhir-py/tree/main/google-fhir-views)
and
[SQL-on-FHIR v2 spec](https://build.fhir.org/ig/FHIR/sql-on-fhir-v2/).
Please see the [query](../query) directory for details of the new approach and
examples.

# How to query the data warehouse

This directory contains a [query library](query_lib.py) for easy querying of
FHIR based data warehouses. The library intend to hide details of the
distributed environment in which the underlying data is stored and processed
like Apache Spark/Parquet or BigQuery.

For more details see [these slides](https://docs.google.com/presentation/d/1Np_A8E6ZAQyWWyjMkvkM8Ytn-arunz2iJp4eXm8KRcA/edit?resourcekey=0-2aRlBmdI6hCm2XvrX8UrWQ#slide=id.ge43a6e778b_0_289).
For a quick start on how to use the library, see [this notebook](test_query_lib.ipynb).

The rest of this document describes how the query library can be set up and
developed with a focus on the Spark+Parquet use case.

## Setting up Apache Spark

Details on how to set up a Spark cluster with all different cluster management
options is beyond this doc. Here we only show how to run the
[sample queries](test_spark.ipynb) in the local mode.

The sample queries are written using the Python API of Spark (a.k.a. `pyspark`)
so it is a good idea to first create a Python `virtualenv`:

```
$ virtualenv -p python3.8 venv
$ . ./venv/bin/activate
(venv) $ pip3 install pyspark
(venv) $ pip3 install pandas
```

Or you can just do `pip3 install -r requirements.txt` in the `venv`.

*Tip*: The initial step of the `validate_indicators.sh` script creates a
`venv_test` and sets up all the dependencies.

Once this is done, you can run `pyspark` to get into an interactive console.
This is useful for developing queries step by step, but we won't use it once
we have developed the full query plan.

Some test Parquet files are stored in the `dwh/test_files` directory. These are
generated by the batch pipeline from the demo data in the test docker image.
In particular, there are `Patient` and `Observation` sub-folders with some
Parquet files in them. Here is a sample command for the indicator calculation
script:

```
spark-submit indicators.py --src_dir=./test_files --last_date=2020-12-30 \
  --num_days=28 --output_csv=TX_PVLS.csv
```

To see a list of options with their descriptions, try:

```
$ python3 indicators.py --help
```

There is also a [`sample_indicator.py`](dwh/sample_indicator.py) script to
show how the same query with PySpark API can be done with Spark SQL:

```
spark-submit sample_indicator.py --src_dir=test_files/ \
  --base_patient_url=http://localhost:8099/openmrs/ws/fhir2/R4/Patient/ \
  --num_days=60 --last_date=2020-04-30
  --code_list {SPACE SEPARATED LIST OF CODES}
```

## Using Jupyter Notebooks

While in your virtualenv, run:

```bash
(venv) $ pip3 install jupyter
```

Then from a terminal that can run GUI applications, run:

```bash
(venv) $ jupyter notebook
```

This should start a Jupyter server and bring up its UI in a browser tab.

In case that auto-completion functionality is not working, this might be due
to a recent regression; check the solution
[here](https://github.com/ipython/ipython/issues/12740#issuecomment-751273584)
to downgrade your `jedi`.

Also if you like to automatically record the execution time of different cells
(and other nice features/extensions) install
[nbextensions](https://jupyter-contrib-nbextensions.readthedocs.io/en/latest/install.html).

A sample notebook is provided at [`dwh/test_spark.ipynb`](dwh/test_spark.ipynb)
which uses `matplotlib` too, so to run this you need to install it too:

```bash
(venv) $ pip3 install matplotlib
```

At the end of this notebook, we wrap up the tests
into reusable functions that we can use outside the Jupyter environment e.g.,
for automated indicator computation.
